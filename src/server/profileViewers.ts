/**
 * Who may read a traveler profile besides its owner.
 *
 * `profiles` uses `read: 'shared'` with `isPublic` as its visibility field, so
 * a profile is readable by its owner, by anyone when `isPublic` is 1, and by
 * the user ids in its `viewers` collaborator list. That list holds the people
 * the owner is already connected to: co-members of any trip and the other side
 * of any join request. Hidden profiles therefore stay out of the People
 * directory while hosts can still review a requester and trip-mates still see
 * each other's names and avatars.
 *
 * Actions run RBAC-off, so these helpers may update other users' rows.
 */
import type { ActionTools } from 'deepspace/worker'
import { listMembers } from './trips'

/** Upper bound on one profile's viewer list; the oldest connections drop first. */
export const MAX_VIEWERS = 500
const TRIPS_SCANNED = 100
const REQUESTS_SCANNED = 200

type ProfileRow = { userId: string; viewers?: unknown }

/** Returns a new viewer list with `add` appended, deduplicated, without `self`, capped. */
export function mergeViewers(current: unknown, add: readonly string[], self: string): string[] {
  const existing = Array.isArray(current) ? current.filter((v): v is string => typeof v === 'string') : []
  const merged = [...new Set([...existing, ...add])].filter((id) => id && id !== self)
  return merged.slice(-MAX_VIEWERS)
}

/** Lets every user in `userIds` read every other one's profile. Missing profiles are skipped. */
export async function shareProfiles(tools: ActionTools, userIds: readonly string[]): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length < 2) return
  for (const uid of ids) {
    const r = await tools.query<ProfileRow>('profiles', { where: { userId: uid }, limit: 1 })
    const row = r.success ? r.data.records[0] : undefined
    if (!row) continue
    const viewers = mergeViewers(row.data.viewers, ids, uid)
    const res = await tools.update('profiles', row.recordId, { viewers })
    if (!res.success) throw new Error(`share profile ${uid}: ${res.error}`)
  }
}

/** Everyone `userId` is connected to: trip co-members and join-request counterparts. */
export async function connectionsOf(tools: ActionTools, userId: string): Promise<string[]> {
  const out = new Set<string>()
  const memberships = await tools.query<{ teamId: string; status: string }>('team_members', { where: { userId }, limit: TRIPS_SCANNED })
  if (memberships.success) {
    for (const m of memberships.data.records) {
      if (m.data.status === 'left') continue
      for (const co of await listMembers(tools, m.data.teamId)) out.add(co.data.userId)
    }
  }
  for (const [mine, other] of [['requesterId', 'ownerId'], ['ownerId', 'requesterId']] as const) {
    const reqs = await tools.query<Record<string, string>>('join_requests', { where: { [mine]: userId }, limit: REQUESTS_SCANNED })
    if (reqs.success) for (const r of reqs.data.records) out.add(r.data[other])
  }
  out.delete(userId)
  return [...out]
}
