import { describe, expect, it } from 'vitest'
import { APICallError } from 'ai'
import { FAST_MODEL_PREFS, MAIN_MODEL_PREFS, isModelUnavailable, rankModels } from './llm'

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
