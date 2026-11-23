/**
 * Groq for every Hive LLM call (panel chat, group chat, compaction summary,
 * place info). Groq speaks the OpenAI chat API, so the AI SDK's
 * openai-compatible provider drives it with plain streamText / generateText.
 *
 * The key is app-owned (`npx deepspace secrets set GROQ_API_KEY`) and never
 * leaves the worker. Every caller reserves a unit in src/server/limits.ts
 * before calling in here.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { APICallError, generateText, type LanguageModel, type ToolSet } from 'ai'
import { DEFAULT_CONTEXT_CONFIG, capToolResultSize, type ChatTurn, type Summarizer } from 'deepspace/worker'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
/**
 * Preferred models, best first. Groq retires model ids over time and a
 * project can restrict which models a key may call, so the live model is
 * resolved at runtime (see resolveHiveModels) instead of hard-coded.
 */
export const MAIN_MODEL_PREFS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'moonshotai/kimi-k2-instruct-0905',
  'moonshotai/kimi-k2-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]
export const FAST_MODEL_PREFS = ['llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'meta-llama/llama-4-scout-17b-16e-instruct']
/** Ids that are not chat models (speech, safety classifiers, agents). */
const NON_CHAT = /whisper|guard|tts|playai|orpheus|compound|safeguard|distil/i
const RESOLVE_TTL_MS = 60 * 60 * 1000
const PROBE_TIMEOUT_MS = 8_000
/** Most model steps (tool round-trips + final answer) in one Hive turn. */
export const HIVE_MAX_STEPS = 8

const SUMMARY_MAX_CHARS = 24_000

export interface GroqEnv {
  GROQ_API_KEY?: string
}

/** Thrown when the owner has not configured GROQ_API_KEY. */
export class HiveUnavailable extends Error {
  constructor() {
    super('Hive is offline: GROQ_API_KEY is not set')
    this.name = 'HiveUnavailable'
  }
}

export type HiveModels = { main: string; fast: string }

/** Order candidates: preferred ids that the key can see first, then any other chat model. */
export function rankModels(available: string[], prefs: string[]): string[] {
  const chat = available.filter((id) => !NON_CHAT.test(id))
  const preferred = prefs.filter((id) => chat.includes(id))
  return [...preferred, ...chat.filter((id) => !preferred.includes(id)).sort()]
}

async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${GROQ_BASE_URL}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`groq /models ${res.status}`)
  const body = (await res.json()) as { data?: Array<{ id?: string; active?: boolean }> }
  return (body.data ?? []).filter((m) => typeof m.id === 'string' && m.active !== false).map((m) => m.id as string)
}

/** One-token call: proves the key may actually use the model (listing is not enough). */
async function probe(env: GroqEnv, id: string): Promise<boolean> {
  try {
    await generateText({ model: groqModel(env, id), prompt: 'ok', maxOutputTokens: 1, maxRetries: 0, abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return true
  } catch (err) {
    // Rate-limited means the model exists and is allowed.
    if (rateLimitRetryAfter(err) != null) return true
    console.error(`[llm] probe ${id} failed: ${(err as Error).message.slice(0, 160)}`)
    return false
  }
}

async function firstWorking(env: GroqEnv, candidates: string[]): Promise<string | null> {
  for (const id of candidates) if (await probe(env, id)) return id
  return null
}

let resolved: { at: number; models: Promise<HiveModels> } | null = null

/**
 * The main and fast Hive models this key can call right now. Cached per
 * worker isolate for an hour; a failed resolution is not cached.
 */
export function resolveHiveModels(env: GroqEnv): Promise<HiveModels> {
  const apiKey = env.GROQ_API_KEY?.trim()
  if (!apiKey) return Promise.reject(new HiveUnavailable())
  if (resolved && Date.now() - resolved.at < RESOLVE_TTL_MS) return resolved.models
  const models = (async () => {
    const available = await listModels(apiKey)
    const main = await firstWorking(env, rankModels(available, MAIN_MODEL_PREFS))
    if (!main) throw new Error('No Groq chat model is available to this key')
    const fast = (await firstWorking(env, rankModels(available, FAST_MODEL_PREFS).filter((id) => id !== main).slice(0, 3))) ?? main
    console.info(`[llm] Hive models: main=${main} fast=${fast} (of ${available.length})`)
    return { main, fast }
  })()
  resolved = { at: Date.now(), models }
  models.catch(() => {
    if (resolved?.models === models) resolved = null
  })
  return models
}

/** Drop the cached choice, e.g. after a model starts returning 404. */
export function forgetHiveModels(): void {
  resolved = null
}

/** Provider said the model id is unknown or not allowed for this key. */
export function isModelUnavailable(error: unknown): boolean {
  const err = error instanceof Error && 'lastError' in error ? (error as { lastError: unknown }).lastError : error
  if (!APICallError.isInstance(err)) return false
  return err.statusCode === 404 || /model_not_found|does not exist|do not have access/i.test(err.responseBody ?? err.message)
}

export function groqModel(env: GroqEnv, modelId: string): LanguageModel {
  const apiKey = env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new HiveUnavailable()
  return createOpenAICompatible({ name: 'groq', baseURL: GROQ_BASE_URL, apiKey })(modelId)
}

export function hasGroq(env: GroqEnv): boolean {
  return Boolean(env.GROQ_API_KEY?.trim())
}

/** Groq 429 → seconds to wait (from retry-after), else null. */
export function rateLimitRetryAfter(error: unknown): number | null {
  const err = error instanceof Error && 'lastError' in error ? (error as { lastError: unknown }).lastError : error
  if (!APICallError.isInstance(err) || err.statusCode !== 429) return null
  const header = Number(err.responseHeaders?.['retry-after'])
  return Number.isFinite(header) && header > 0 ? Math.ceil(header) : 10
}

/** User-facing text for an LLM failure; never leaks provider internals. */
export function hiveErrorText(error: unknown): string {
  if (error instanceof HiveUnavailable) return error.message
  if (isModelUnavailable(error)) {
    forgetHiveModels()
    return 'Hive switched to a different model. Tap Retry.'
  }
  const wait = rateLimitRetryAfter(error)
  if (wait != null) return `Hive is catching its breath — try again in ${wait}s.`
  // Provider failures (HTTP / retries exhausted) stay generic; tool errors
  // (TripError, validation) carry useful, already user-facing messages.
  const isProvider = APICallError.isInstance(error) || (error instanceof Error && 'lastError' in error)
  if (!isProvider && error instanceof Error && error.message) return error.message
  return 'Hive hit a snag answering that. Try again in a moment.'
}

/** Cap each tool result before the model sees it (same cap DeepSpace agents use). */
export function capTools<T extends ToolSet>(tools: T): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, def]) => {
      const execute = def.execute
      if (typeof execute !== 'function') return [name, def]
      return [
        name,
        {
          ...def,
          execute: async (...args: Parameters<typeof execute>) =>
            capToolResultSize(await execute(...args), DEFAULT_CONTEXT_CONFIG.toolResultCap),
        },
      ]
    }),
  ) as T
}

function transcript(turns: ChatTurn[]): string {
  const text = turns
    .filter((t) => t.content && t.role !== 'system')
    .map((t) => `${t.role === 'user' ? 'User' : 'Hive'}: ${t.content}`)
    .join('\n')
  return text.length > SUMMARY_MAX_CHARS ? text.slice(-SUMMARY_MAX_CHARS) : text
}

/** Compaction summarizer on Groq (replaces DeepSpace's Claude-billed default). */
export function groqSummarizer(env: GroqEnv): Summarizer {
  return async (turns) => {
    const { fast } = await resolveHiveModels(env)
    const { text } = await generateText({
      model: groqModel(env, fast),
      instructions:
        'Summarize this trip-planning conversation for your own later reference. Keep decisions, places, dates, budgets, preferences and open questions. Plain bullet points, under 250 words.',
      prompt: transcript(turns),
      maxOutputTokens: 600,
    })
    return text.trim()
  }
}
