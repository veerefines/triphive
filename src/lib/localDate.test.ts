import { describe, expect, it } from 'vitest'
import { addLocalDays, localIsoDate } from './localDate'

describe('localIsoDate', () => {
  it('formats the local calendar day, not the UTC day', () => {
    const lateEvening = new Date(2026, 10, 23, 23, 30)
    expect(localIsoDate(lateEvening)).toBe('2026-11-23')
  })

  it('pads month and day', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 0, 15))).toBe('2026-01-05')
  })
})

describe('addLocalDays', () => {
  it('adds days across a month end without mutating the input', () => {
    const start = new Date(2026, 10, 29, 22, 0)
    expect(addLocalDays(start, 3)).toBe('2026-12-02')
    expect(localIsoDate(start)).toBe('2026-11-29')
  })
})
