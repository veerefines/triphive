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
/** Main Hive model: strong tool calling on Groq. */
export const HIVE_MODEL = 'llama-3.3-70b-versatile'
/** Cheap/fast model for summaries and as the fallback when the main one is rate-limited. */
export const HIVE_FAST_MODEL = 'llama-3.1-8b-instant'
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

export function groqModel(env: GroqEnv, modelId: string = HIVE_MODEL): LanguageModel {
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
    const { text } = await generateText({
      model: groqModel(env, HIVE_FAST_MODEL),
      instructions:
        'Summarize this trip-planning conversation for your own later reference. Keep decisions, places, dates, budgets, preferences and open questions. Plain bullet points, under 250 words.',
      prompt: transcript(turns),
      maxOutputTokens: 600,
    })
    return text.trim()
  }
}
