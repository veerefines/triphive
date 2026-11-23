/**
 * Owner-only demo reset: wipe every trip + social row, then seed the demo
 * world from src/data/demo.ts (planned by src/lib/demoPlan.ts).
 *
 * Split into phases the client calls in a loop, so one request never runs
 * into the Workers subrequest cap: `wipe` deletes a batch of trips per call
 * and reports what is left, `seed` writes the world once the slate is clean.
 */
import type { ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { HIVE_SENDER } from '../ai/hive-group'
import { DEMO_PROFILES } from '../data/demo'
import { planSeed, type OwnedRow, type Row } from '../lib/demoPlan'
import { TripError, inviteCode, userNames } from './trips'
import { purgeTrip } from './social'

const TRIPS_PER_WIPE_CALL = 20
const SCAN_LIMIT = 500
const MAX_CLEAR_ROUNDS = 10

export type ResetPhase = 'wipe' | 'seed'
export type ResetResult = { phase: ResetPhase; remainingTrips: number; done: boolean; seeded?: Record<string, number> }

type ToolsFor = (userId: string) => Promise<ActionTools>

function must(r: { success: boolean; error?: string }, what: string): void {
  if (!r.success) throw new TripError(`Demo reset failed at ${what}: ${r.error ?? 'unknown error'}`)
}

/** Tools acting as `userId`. Lazy import: action-routes imports the actions module. */
function toolsFactory(env: Env, callerJwt: string): ToolsFor {
  const cache = new Map<string, ActionTools>()
  return async (userId) => {
    const hit = cache.get(userId)
    if (hit) return hit
    const { createActionTools } = await import('./action-routes')
    const tools = createActionTools(env, userId, callerJwt)
    cache.set(userId, tools)
    return tools
  }
}

async function countTrips(tools: ActionTools): Promise<number> {
  const r = await tools.query('trips', { limit: SCAN_LIMIT })
  return r.success ? r.data.records.length : 0
}

/**
 * Delete every row of a collection. deleteWhere refuses an empty filter, so
 * delete by each distinct value of a field every row carries.
 */
async function clearCollection(tools: ActionTools, collection: string, field: string, keep?: (row: Row) => boolean) {
  for (let round = 0; round < MAX_CLEAR_ROUNDS; round++) {
    const r = await tools.query<Row>(collection, { limit: SCAN_LIMIT })
    if (!r.success) return
    const rows = r.data.records.filter((rec) => !keep?.(rec.data))
    if (!rows.length) return
    if (keep) {
      for (const rec of rows) await tools.remove(collection, rec.recordId)
    } else {
      const values = [...new Set(rows.map((rec) => rec.data[field]).filter((v) => v !== undefined && v !== null && v !== ''))]
      for (const v of values) await tools.deleteWhere(collection, { [field]: v as string }, SCAN_LIMIT)
      if (values.length === 0) for (const rec of rows) await tools.remove(collection, rec.recordId)
    }
  }
}

export async function wipeStep(tools: ActionTools, ownerId: string): Promise<ResetResult> {
  const r = await tools.query('trips', { limit: TRIPS_PER_WIPE_CALL })
  must(r, 'list trips')
  const batch = r.success ? r.data.records : []
  for (const trip of batch) await purgeTrip(tools, trip.recordId)

  const remainingTrips = await countTrips(tools)
  if (remainingTrips > 0) return { phase: 'wipe', remainingTrips, done: false }

  // Trips gone: clear the rows that outlive them.
  await clearCollection(tools, 'place_reviews', 'city')
  await clearCollection(tools, 'ai_usage', 'day')
  await clearCollection(tools, 'profiles', 'userId', (row) => row.userId === ownerId)
  return { phase: 'wipe', remainingTrips: 0, done: true }
}

async function writeOwned(toolsFor: ToolsFor, collection: string, rows: OwnedRow[]) {
  for (const row of rows) {
    const tools = await toolsFor(row.as)
    must(await tools.create(collection, row.data), `${collection} for ${row.as}`)
  }
}

async function writeAll(tools: ActionTools, collection: string, rows: Row[]) {
  for (const data of rows) must(await tools.create(collection, data), collection)
}

async function registerPersonas(tools: ActionTools) {
  for (const p of DEMO_PROFILES) {
    // Personas never sign in; a users row makes their names resolve everywhere.
    must(await tools.registerUser({ userId: p.userId, name: p.displayName }), `register ${p.displayName}`)
  }
}

export async function seedStep(env: Env, ownerId: string, callerJwt: string, today: string): Promise<ResetResult> {
  const toolsFor = toolsFactory(env, callerJwt)
  const owner = await toolsFor(ownerId)
  if ((await countTrips(owner)) > 0) throw new TripError('Wipe first: trips still exist')

  const names = await userNames(owner, [ownerId])
  const plan = planSeed({
    ownerId,
    ownerName: names[ownerId]?.name ?? 'You',
    today,
    hiveSender: HIVE_SENDER,
    newId: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
    inviteCode,
    nowIso: new Date().toISOString(),
  })

  await registerPersonas(owner)
  await writeOwned(toolsFor, 'profiles', plan.profiles.filter((p) => p.as !== ownerId))

  const hostOf = new Map(plan.members.filter((m) => m.role === 'owner').map((m) => [m.teamId, String(m.userId)]))
  for (const trip of plan.trips) {
    const host = await toolsFor(hostOf.get(trip.id) ?? ownerId)
    must(await host.create('trips', trip.data, trip.id), `trip ${String(trip.data.title)}`)
  }
  await writeAll(owner, 'team_members', plan.members)
  await writeAll(owner, 'stops', plan.stops)
  await writeOwned(toolsFor, 'prefs', plan.prefs)
  await writeAll(owner, 'trip_messages', plan.messages)
  await writeAll(owner, 'activity', plan.activity)
  await writeAll(owner, 'public_trips', plan.listings)
  for (const req of plan.requests) must(await owner.create('join_requests', req.data, req.id), 'join request')
  await writeAll(owner, 'dm_messages', plan.dms)
  await writeAll(owner, 'place_reviews', plan.reviews)

  return {
    phase: 'seed',
    remainingTrips: plan.trips.length,
    done: true,
    seeded: { trips: plan.trips.length, stops: plan.stops.length, reviews: plan.reviews.length, requests: plan.requests.length },
  }
}
