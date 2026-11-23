import { describe, expect, test } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { LIMITS, bucketKey, reserve, reserveAll } from './limits'

type Rec = { recordId: string; data: { userId: string; day: string; count: number } }

/** In-memory ai_usage with the same unique [userId, day] rule as the schema. */
function fakeTools(opts: { failCreateOnce?: boolean } = {}) {
  const rows: Rec[] = []
  let failCreate = opts.failCreateOnce ?? false
  const tools = {
    query: async (_c: string, q: { where: { userId: string; day: string } }) => ({
      success: true,
      data: { records: rows.filter((r) => r.data.userId === q.where.userId && r.data.day === q.where.day).map((r) => ({ ...r, data: { ...r.data } })) },
    }),
    create: async (_c: string, data: Rec['data']) => {
      if (failCreate) {
        failCreate = false
        rows.push({ recordId: `r${rows.length}`, data: { ...data, count: 1 } }) // a racing writer won
        return { success: false }
      }
      if (rows.some((r) => r.data.userId === data.userId && r.data.day === data.day)) return { success: false }
      rows.push({ recordId: `r${rows.length}`, data: { ...data } })
      return { success: true }
    },
    update: async (_c: string, id: string, patch: { count: number }) => {
      const i = rows.findIndex((r) => r.recordId === id)
      if (i < 0) return { success: false }
      rows[i] = { ...rows[i], data: { ...rows[i].data, ...patch } }
      return { success: true }
    },
  }
  return { tools: tools as unknown as ActionTools, rows }
}

describe('bucketKey', () => {
  const at = new Date('2026-11-22T18:42:07Z')
  test('day, hour and minute windows produce distinct stamps', () => {
    expect(bucketKey({ kind: 'hive', window: 'day' }, at)).toBe('hive:2026-11-22')
    expect(bucketKey({ kind: 'x', window: 'hour' }, at)).toBe('x:2026-11-22T18')
    expect(bucketKey({ kind: 'burst', window: 'minute' }, at)).toBe('burst:2026-11-22T18:42')
  })
})

describe('reserve', () => {
  test('allows up to the cap then denies with 429', async () => {
    const { tools } = fakeTools()
    const limit = { kind: 't', cap: 3, window: 'day' } as const
    for (let i = 0; i < 3; i++) expect((await reserve(tools, 'u1', limit)).ok).toBe(true)
    expect(await reserve(tools, 'u1', limit)).toMatchObject({ ok: false, status: 429 })
  })

  test('subjects are counted separately', async () => {
    const { tools } = fakeTools()
    const limit = { kind: 't', cap: 1, window: 'day' } as const
    expect((await reserve(tools, 'u1', limit)).ok).toBe(true)
    expect((await reserve(tools, 'u2', limit)).ok).toBe(true)
  })

  test('refund gives the unit back', async () => {
    const { tools, rows } = fakeTools()
    const limit = { kind: 't', cap: 1, window: 'day' } as const
    const r = await reserve(tools, 'u1', limit)
    if (!r.ok) throw new Error('expected ok')
    await r.refund()
    expect(rows[0].data.count).toBe(0)
    expect((await reserve(tools, 'u1', limit)).ok).toBe(true)
  })

  test('a lost create race retries as an update instead of failing', async () => {
    const { tools, rows } = fakeTools({ failCreateOnce: true })
    const r = await reserve(tools, 'u1', { kind: 't', cap: 5, window: 'day' })
    expect(r.ok).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0].data.count).toBe(2)
  })

  test('a new window resets the count', async () => {
    const { tools } = fakeTools()
    const limit = LIMITS.burst
    const t0 = new Date('2026-11-22T10:00:00Z')
    for (let i = 0; i < limit.cap; i++) await reserve(tools, 'u1', limit, 1, t0)
    expect((await reserve(tools, 'u1', limit, 1, t0)).ok).toBe(false)
    expect((await reserve(tools, 'u1', limit, 1, new Date('2026-11-22T10:01:00Z'))).ok).toBe(true)
  })
})

describe('reserveAll', () => {
  test('refunds earlier claims when a later one is denied', async () => {
    const { tools, rows } = fakeTools()
    const full = { kind: 'full', cap: 0, window: 'day' } as const
    const r = await reserveAll(tools, [['u1', LIMITS.hiveChat], ['u1', full]])
    expect(r.ok).toBe(false)
    expect(rows.find((x) => x.data.day.startsWith('hive:'))?.data.count).toBe(0)
  })
})
