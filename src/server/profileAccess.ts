/**
 * Hidden-profile access for connected travelers.
 *
 * `profiles` is readable by its owner and, when `isPublic` is 1, by everyone
 * (`read: 'published'`). A hidden profile still has to reach the people the
 * owner already travels or talks with: trip co-members and the other side of a
 * join request, so a host can review a requester. Those are computed here on
 * demand. No access list is stored on the profile row, so nobody can read who
 * a traveler is connected to.
 *
 * Actions run RBAC-off, so these helpers may read other users' rows.
 */
import type { ActionTools } from 'deepspace/worker'
import { listMembers } from './trips'

const TRIPS_SCANNED = 100
const REQUESTS_SCANNED = 200

/** Profile columns a connected traveler may see. Anything else stays server-side. */
const DISPLAY_FIELDS = ['userId', 'displayName', 'avatarEmoji', 'homeCity', 'bio', 'travelStyle', 'interests', 'languages', 'isPublic'] as const

type ProfileData = Record<string, unknown> & { userId: string; isPublic?: unknown }
export type DisplayProfile = Partial<Record<(typeof DISPLAY_FIELDS)[number], unknown>> & { userId: string }

/** Hidden profiles among `rows` that belong to `connections`, reduced to display fields. */
export function hiddenProfilesFor(rows: readonly ProfileData[], connections: readonly string[]): DisplayProfile[] {
  const allowed = new Set(connections)
  return rows
    .filter((r) => allowed.has(r.userId) && r.isPublic !== 1)
    .map((r) => Object.fromEntries(DISPLAY_FIELDS.filter((f) => f in r).map((f) => [f, r[f]])) as DisplayProfile)
}

/** Everyone `userId` is connected to: active trip co-members and join-request counterparts. */
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

/** Hidden profiles the caller may see because they share a trip or a join request. */
export async function connectedProfiles(tools: ActionTools, userId: string): Promise<DisplayProfile[]> {
  const connections = await connectionsOf(tools, userId)
  if (connections.length === 0) return []
  const rows: ProfileData[] = []
  for (const uid of connections) {
    const r = await tools.query<ProfileData>('profiles', { where: { userId: uid }, limit: 1 })
    if (r.success && r.data.records[0]) rows.push(r.data.records[0].data)
  }
  return hiddenProfilesFor(rows, connections)
}
