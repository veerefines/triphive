/**
 * One rate limiter for everything owner-billed (Groq, Google Places, join
 * requests, PDF email). Counters live in the server-only `ai_usage`
 * collection, one row per (subject, bucket), unique on [userId, day].
 *
 * `reserve` is create-or-update with two safety nets the old read-then-write
 * counters lacked:
 *  - a fresh-bucket race (two creates hitting the unique key) retries once as
 *    an update instead of failing the request;
 *  - after writing, it re-reads the row and refunds if a concurrent writer
 *    pushed the count past the cap, so overshoot is undone, not accepted.
 *
 * Known limit: the store has no atomic increment, so two writers that read
 * the same count both store count+1 and one increment is lost. Overshoot is
 * bounded by one subject's in-flight concurrency (and the burst limit makes
 * that small). A per-subject Durable Object counter would close it.
 */
import type { ActionTools } from 'deepspace/worker'

export interface Limit {
  /** Bucket family, e.g. "hive" or "burst". Part of the stored key. */
  kind: string
  /** Max units per window. */
  cap: number
  /** Window length: a UTC day, an hour, or a minute. */
  window: 'day' | 'hour' | 'minute'
}

export const LIMITS = {
  /** Hive panel chat turns per user per day. */
  hiveChat: { kind: 'hive', cap: 30, window: 'day' },
  /** Group-chat Hive runs per trip per day. */
  hiveGroup: { kind: 'hive-group', cap: 40, window: 'day' },
  /** Any Groq call per user per minute (burst guard). */
  burst: { kind: 'burst', cap: 8, window: 'minute' },
  /** Google Places lookups per user per day. */
  places: { kind: 'places', cap: 100, window: 'day' },
  /** Proxied Google photo fetches per app per day (cache absorbs repeats). */
  photos: { kind: 'photos', cap: 300, window: 'day' },
  /** Join requests per user per day. */
  requests: { kind: 'requests', cap: 10, window: 'day' },
  /** Plan emails per trip per hour. */
  planEmail: { kind: 'plan-email', cap: 3, window: 'hour' },
} as const satisfies Record<string, Limit>

export type Reservation =
  | { ok: true; refund: () => Promise<void> }
  | { ok: false; status: 429 | 503; error: string }

/** Stored bucket key for a limit at a moment in time, e.g. "hive:2026-11-22". */
export function bucketKey(limit: Pick<Limit, 'kind' | 'window'>, now: Date = new Date()): string {
  const iso = now.toISOString()
  const stamp = limit.window === 'day' ? iso.slice(0, 10) : limit.window === 'hour' ? iso.slice(0, 13) : iso.slice(0, 16)
  return `${limit.kind}:${stamp}`
}

const WINDOW_WORD: Record<Limit['window'], string> = { day: 'today', hour: 'this hour', minute: 'this minute' }

export function limitMessage(limit: Limit): string {
  if (limit.window === 'minute') return 'Hive is catching its breath — try again in a few seconds.'
  return `Limit reached (${limit.cap} ${WINDOW_WORD[limit.window]}). Try again ${limit.window === 'day' ? 'tomorrow' : 'later'}.`
}

type Row = { recordId: string; count: number }

async function readRow(tools: ActionTools, subject: string, day: string): Promise<Row | null | 'error'> {
  const r = await tools.query<{ count: number }>('ai_usage', { where: { userId: subject, day }, limit: 1 })
  if (!r.success) return 'error'
  const row = r.data.records[0]
  return row ? { recordId: row.recordId, count: Number(row.data.count ?? 0) } : null
}

async function writeCount(tools: ActionTools, subject: string, day: string, row: Row | null, next: number): Promise<boolean> {
  const res = row ? await tools.update('ai_usage', row.recordId, { count: next }) : await tools.create('ai_usage', { userId: subject, day, count: next })
  return res.success
}

/**
 * Reserve `units` of `limit` for `subject` (a user id, or e.g. "trip:<id>").
 * Fails closed: a storage error denies the call.
 */
export async function reserve(tools: ActionTools, subject: string, limit: Limit, units = 1, now: Date = new Date()): Promise<Reservation> {
  const day = bucketKey(limit, now)
  const unavailable: Reservation = { ok: false, status: 503, error: 'Usage check failed, try again' }
  const denied: Reservation = { ok: false, status: 429, error: limitMessage(limit) }

  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await readRow(tools, subject, day)
    if (row === 'error') return unavailable
    const used = row?.count ?? 0
    if (used + units > limit.cap) return denied
    if (!(await writeCount(tools, subject, day, row, used + units))) continue // lost a create race: retry as update

    const after = await readRow(tools, subject, day)
    const refund = async () => {
      const current = await readRow(tools, subject, day)
      if (current && current !== 'error') await writeCount(tools, subject, day, current, Math.max(0, current.count - units))
    }
    // A concurrent writer stored a smaller count over ours, or pushed past the
    // cap: either way the reservation is not safely ours.
    if (after !== 'error' && after && after.count > limit.cap) {
      await refund()
      return denied
    }
    return { ok: true, refund }
  }
  return unavailable
}

/** Reserve several limits in order; on any denial, refund the ones already taken. */
export async function reserveAll(tools: ActionTools, claims: Array<[subject: string, limit: Limit]>): Promise<Reservation> {
  const taken: Array<() => Promise<void>> = []
  for (const [subject, limit] of claims) {
    const r = await reserve(tools, subject, limit)
    if (!r.ok) {
      await Promise.all(taken.map((f) => f()))
      return r
    }
    taken.push(r.refund)
  }
  return { ok: true, refund: async () => void (await Promise.all(taken.map((f) => f()))) }
}
