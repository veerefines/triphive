import { describe, expect, it } from 'vitest'
import { buildHiveAsk, summarizePlan } from './hive-ask'

const me = 'u1'
const row = (senderId: string, text: string) => ({ senderId, text })

describe('buildHiveAsk', () => {
  it('returns null unless the newest message is mine and mentions @Hive', () => {
    expect(buildHiveAsk([row(me, 'food near Dawki?')], me)).toBeNull()
    expect(buildHiveAsk([row('u2', '@Hive food near Dawki?')], me)).toBeNull()
    expect(buildHiveAsk([], me)).toBeNull()
  })

  it('returns null when the mention carries no real question', () => {
    expect(buildHiveAsk([row(me, '@Hive')], me)).toBeNull()
    expect(buildHiveAsk([row(me, '@Hive ok')], me)).toBeNull()
  })

  it('strips the handle and keeps only a short tail of human context', () => {
    const rows = [
      row('u2', 'one'),
      row('hive', 'old hive reply'),
      row('u2', 'two'),
      row('u3', 'three'),
      row('u2', 'four'),
      row(me, '@Hive what food places near Dawki Lake?'),
    ]
    const ask = buildHiveAsk(rows, me)
    expect(ask?.question).toBe('what food places near Dawki Lake?')
    expect(ask?.context).toEqual([row('u2', 'two'), row('u3', 'three'), row('u2', 'four')])
  })

  it('truncates long context lines', () => {
    const ask = buildHiveAsk([row('u2', 'x'.repeat(900)), row(me, '@Hive cafes?')], me)
    expect(ask?.context[0].text.length).toBeLessThanOrEqual(200)
  })
})

describe('summarizePlan', () => {
  it('lists each trip day with its stop titles and marks free days', () => {
    const out = summarizePlan(['2026-12-01', '2026-12-02'], [
      { date: '2026-12-01', title: 'Ward\'s Lake', start: '16:00' },
      { date: '2026-12-01', title: 'Police Bazaar', start: '14:00' },
    ])
    expect(out).toBe("2026-12-01: 14:00 Police Bazaar; 16:00 Ward's Lake\n2026-12-02: (free)")
  })
})
