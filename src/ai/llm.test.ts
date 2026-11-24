import { describe, expect, it } from 'vitest'
import { APICallError } from 'ai'
import { stripReasoning, FAST_MODEL_PREFS, HIVE_CONTEXT_CONFIG, MAIN_MODEL_PREFS, hiveErrorText, isModelUnavailable, isRequestTooLarge, pickByCapacity, rankModels, createModelCooldown, HIVE_MAX_OUTPUT_TOKENS } from './llm'

function apiError(statusCode: number, responseBody: string) {
  return new APICallError({ message: responseBody, url: 'https://api.groq.com', requestBodyValues: {}, statusCode, responseBody })
}

describe('rankModels', () => {
  it('puts available preferred models first, in preference order', () => {
    const ranked = rankModels(['qwen/qwen3-32b', 'openai/gpt-oss-120b', 'zeta-chat'], MAIN_MODEL_PREFS)
    expect(ranked).toEqual(['openai/gpt-oss-120b', 'qwen/qwen3-32b', 'zeta-chat'])
  })

  it('drops speech, guard and agent models', () => {
    const ranked = rankModels(['whisper-large-v3', 'meta-llama/llama-guard-4-12b', 'groq/compound', 'llama-3.1-8b-instant'], FAST_MODEL_PREFS)
    expect(ranked).toEqual(['llama-3.1-8b-instant'])
  })

  it('returns an empty list when nothing usable is listed', () => {
    expect(rankModels([], MAIN_MODEL_PREFS)).toEqual([])
  })
})

describe('isModelUnavailable', () => {
  it('detects a retired or blocked model', () => {
    expect(isModelUnavailable(apiError(404, '{"error":{"code":"model_not_found"}}'))).toBe(true)
    expect(isModelUnavailable(apiError(400, 'The model `x` does not exist or you do not have access to it.'))).toBe(true)
  })

  it('ignores rate limits and other errors', () => {
    expect(isModelUnavailable(apiError(429, 'rate limited'))).toBe(false)
    expect(isModelUnavailable(new Error('boom'))).toBe(false)
  })
})

describe('pickByCapacity', () => {
  it('keeps the preferred model when it has room for a full turn', () => {
    expect(pickByCapacity([{ id: 'a', tpm: 250_000 }, { id: 'b', tpm: 30_000 }], 20_000)?.id).toBe('a')
  })

  it('skips a preferred model whose tokens-per-minute limit is too small', () => {
    expect(pickByCapacity([{ id: 'gpt-oss-120b', tpm: 8_000 }, { id: 'scout', tpm: 30_000 }], 20_000)?.id).toBe('scout')
  })

  it('falls back to the roomiest model when none reaches the minimum', () => {
    expect(pickByCapacity([{ id: 'a', tpm: 8_000 }, { id: 'b', tpm: 12_000 }, { id: 'c', tpm: 6_000 }], 20_000)?.id).toBe('b')
  })

  it('treats an unknown limit as roomy and returns null for no models', () => {
    expect(pickByCapacity([{ id: 'a', tpm: null }, { id: 'b', tpm: 30_000 }], 20_000)?.id).toBe('a')
    expect(pickByCapacity([], 20_000)).toBeNull()
  })
})

describe('isRequestTooLarge', () => {
  it('detects Groq tokens-per-minute size rejections', () => {
    expect(isRequestTooLarge(apiError(413, 'Request too large for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Requested 11909'))).toBe(true)
    expect(isRequestTooLarge(apiError(429, 'rate limited'))).toBe(false)
  })

  it('gets its own message instead of the generic snag', () => {
    expect(hiveErrorText(apiError(413, 'Request too large'))).toMatch(/too much for Hive/)
  })
})

describe('HIVE_CONTEXT_CONFIG', () => {
  it('keeps history and tool results far below a free-tier minute of tokens', () => {
    // ~4 chars per token; 8k TPM is the smallest main-model limit seen.
    const promptAndToolsTokens = 2_500
    const firstStepTokens = HIVE_CONTEXT_CONFIG.contextBudget / 4 + promptAndToolsTokens + HIVE_MAX_OUTPUT_TOKENS
    expect(firstStepTokens).toBeLessThan(8_000 * 0.8)
    expect(HIVE_CONTEXT_CONFIG.toolResultCap).toBeLessThanOrEqual(HIVE_CONTEXT_CONFIG.contextBudget)
  })
})

describe('stripReasoning', () => {
  it('removes reasoning parts from assistant turns and keeps everything else', () => {
    const prompt = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] },
      {
        role: 'assistant' as const,
        content: [
          { type: 'reasoning' as const, text: 'thinking' },
          { type: 'tool-call' as const, toolCallId: 't1', toolName: 'find_place', input: {} },
        ],
      },
      { role: 'assistant' as const, content: [{ type: 'reasoning' as const, text: 'only thoughts' }] },
    ]
    const out = stripReasoning(prompt)
    expect(out).toHaveLength(3)
    expect(out[2]).toEqual({ role: 'assistant', content: [{ type: 'tool-call', toolCallId: 't1', toolName: 'find_place', input: {} }] })
    expect(prompt[2].content).toHaveLength(2)
  })
})

describe('pickTurnModel', () => {
  const models = { main: 'openai/gpt-oss-120b', fast: 'openai/gpt-oss-20b' }

  it('uses the main model when it has not been rate-limited', () => {
    const cooldown = createModelCooldown()
    expect(cooldown.pick(models, 1_000)).toBe(models.main)
  })

  it('switches to the fast model while the main model cools down', () => {
    const cooldown = createModelCooldown()
    cooldown.rateLimited(models.main, 20, 1_000)
    expect(cooldown.pick(models, 1_000 + 19_000)).toBe(models.fast)
  })

  it('returns to the main model once retry-after has passed', () => {
    const cooldown = createModelCooldown()
    cooldown.rateLimited(models.main, 20, 1_000)
    expect(cooldown.pick(models, 1_000 + 20_000)).toBe(models.main)
  })

  it('ignores rate limits on the fast model', () => {
    const cooldown = createModelCooldown()
    cooldown.rateLimited(models.fast, 20, 1_000)
    expect(cooldown.pick(models, 2_000)).toBe(models.main)
  })
})
