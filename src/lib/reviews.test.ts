import { describe, expect, test } from 'vitest'
import { cityOf, placeKey, summarizeReviews } from './reviews'

describe('reviews', () => {
  test('keys the same place the same way across spellings', () => {
    expect(placeKey('Time Out Market', 'Lisbon, Portugal')).toBe('time out market|lisbon')
    expect(placeKey('  time-out  MARKET ', 'lisbon')).toBe('time out market|lisbon')
    expect(placeKey('Café Nicola', 'Lisboa')).toBe('cafe nicola|lisboa')
  })

  test('reads the city from a destination', () => {
    expect(cityOf('Shillong, Meghalaya, India')).toBe('shillong')
    expect(cityOf(undefined)).toBe('')
  })

  test('averages rating and spend, ignoring bad rows', () => {
    const s = summarizeReviews([{ rating: 5, spentUsd: 20 }, { rating: 4 }, { rating: 9, spentUsd: 40 }])
    expect(s).toEqual({ count: 2, avgRating: 4.5, avgSpentUsd: 20 })
    expect(summarizeReviews([])).toEqual({ count: 0, avgRating: null, avgSpentUsd: null })
  })
})
