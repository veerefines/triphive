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
import { APICallError, generateText, wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware, type ToolSet } from 'ai'
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
/** Cap on one Hive reply. Groq counts it against tokens-per-minute up front. */
export const HIVE_MAX_OUTPUT_TOKENS = 1_200
/**
 * Below this tokens-per-minute limit a model cannot fit a multi-step tool turn
 * (each step resends the whole context), so a roomier model is preferred.
 */
export const HIVE_MIN_TPM = 20_000
/**
 * History budget sized for Groq, not Claude. DeepSpace's default (240k chars,
 * 30k-char tool results) overflows Groq's free-tier 6k-30k tokens per minute.
 * ~4 chars per token: 16k chars of history + ~2.5k tokens of prompt and tools.
 */
export const HIVE_CONTEXT_CONFIG: typeof DEFAULT_CONTEXT_CONFIG = {
  ...DEFAULT_CONTEXT_CONFIG,
  contextBudget: 16_000,
  toolResultCap: 4_000,
  keepRecentToolResults: 2,
  minKept: 6,
}

const SUMMARY_MAX_CHARS = 14_000

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

/** A model the key may call, with its tokens-per-minute limit when Groq reported one. */
export type ProbedModel = { id: string; tpm: number | null }

/**
 * First candidate (in preference order) with room for a full Hive turn; when
 * none has, the one with the most tokens per minute. An unknown limit counts
 * as roomy, so a missing header never demotes a model.
 */
export function pickByCapacity(probed: ProbedModel[], minTpm: number): ProbedModel | null {
  const roomy = probed.find((m) => m.tpm == null || m.tpm >= minTpm)
  if (roomy) return roomy
  return probed.reduce<ProbedModel | null>((best, m) => (!best || (m.tpm ?? 0) > (best.tpm ?? 0) ? m : best), null)
}

function tpmFrom(headers: Record<string, string | undefined> | undefined): number | null {
  const n = Number(headers?.['x-ratelimit-limit-tokens'])
  return Number.isFinite(n) && n > 0 ? n : null
}

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

/**
 * One-token call: proves the key may actually use the model (listing is not
 * enough) and reads its tokens-per-minute limit from Groq's headers.
 */
async function probe(env: GroqEnv, id: string): Promise<ProbedModel | null> {
  try {
    const r = await generateText({ model: groqModel(env, id), prompt: 'ok', maxOutputTokens: 1, maxRetries: 0, abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return { id, tpm: tpmFrom(r.response.headers) }
  } catch (err) {
    // Rate-limited means the model exists and is allowed.
    if (rateLimitRetryAfter(err) != null) {
      const inner = err instanceof Error && 'lastError' in err ? (err as { lastError: unknown }).lastError : err
      return { id, tpm: APICallError.isInstance(inner) ? tpmFrom(inner.responseHeaders) : null }
    }
    console.error(`[llm] probe ${id} failed: ${(err as Error).message.slice(0, 160)}`)
    return null
  }
}

/** Probe in order, stopping at the first model with room for a full turn. */
async function bestWorking(env: GroqEnv, candidates: string[], minTpm: number): Promise<ProbedModel | null> {
  const probed: ProbedModel[] = []
  for (const id of candidates) {
    const m = await probe(env, id)
    if (!m) continue
    probed.push(m)
    if (m.tpm == null || m.tpm >= minTpm) break
  }
  return pickByCapacity(probed, minTpm)
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
    const best = await bestWorking(env, rankModels(available, MAIN_MODEL_PREFS), HIVE_MIN_TPM)
    if (!best) throw new Error('No Groq chat model is available to this key')
    const main = best.id
    const fastCandidates = rankModels(available, FAST_MODEL_PREFS).filter((id) => id !== main).slice(0, 3)
    const fast = (await bestWorking(env, fastCandidates, 0))?.id ?? main
    console.info(`[llm] Hive models: main=${main} (tpm=${best.tpm ?? '?'}) fast=${fast} (of ${available.length})`)
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

type Prompt = Parameters<NonNullable<LanguageModelMiddleware['transformParams']>>[0]['params']['prompt']

/**
 * Drop reasoning from earlier assistant turns. The openai-compatible provider
 * resends it as `reasoning_content`, which Groq rejects with a 400 on the
 * second step of any tool loop and on any chat with a past reasoning reply.
 */
export function stripReasoning(prompt: Prompt): Prompt {
  return prompt.flatMap<Prompt[number]>((m) => {
    if (m.role !== 'assistant') return [m]
    const content = m.content.filter((part) => part.type !== 'reasoning' && part.type !== 'reasoning-file')
    return content.length ? [{ ...m, content }] : []
  })
}

const groqCompat: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({ ...params, prompt: stripReasoning(params.prompt) }),
}

export function groqModel(env: GroqEnv, modelId: string): LanguageModel {
  const apiKey = env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new HiveUnavailable()
  return wrapLanguageModel({ model: createOpenAICompatible({ name: 'groq', baseURL: GROQ_BASE_URL, apiKey })(modelId), middleware: groqCompat })
}

export function hasGroq(env: GroqEnv): boolean {
  return Boolean(env.GROQ_API_KEY?.trim())
}

/** Groq refused the request as bigger than the model's tokens-per-minute limit. */
export function isRequestTooLarge(error: unknown): boolean {
  const err = error instanceof Error && 'lastError' in error ? (error as { lastError: unknown }).lastError : error
  if (!APICallError.isInstance(err)) return false
  return err.statusCode === 413 || /request too large|reduce your message size/i.test(err.responseBody ?? err.message)
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
  if (isRequestTooLarge(error)) {
    // The cached choice may predate a tier change; re-measure next turn.
    forgetHiveModels()
    return 'That was too much for Hive in one go. Start a new chat or ask something shorter.'
  }
  const wait = rateLimitRetryAfter(error)
  if (wait != null) return `Hive is catching its breath — try again in ${wait}s.`
  // Provider failures (HTTP / retries exhausted) stay generic; tool errors
  // (TripError, validation) carry useful, already user-facing messages.
  const isProvider = APICallError.isInstance(error) || (error instanceof Error && 'lastError' in error)
  if (!isProvider && error instanceof Error && error.message) return error.message
  return 'Hive hit a snag answering that. Try again in a moment.'
}

/** Cap each tool result before the model sees it (Hive's Groq-sized cap). */
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
            capToolResultSize(await execute(...args), HIVE_CONTEXT_CONFIG.toolResultCap),
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
