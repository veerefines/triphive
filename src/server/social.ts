/**
 * Social layer service: profiles, public listings, join requests, request
 * threads and trip group chat. Actions run RBAC-off, so every function here
 * checks the caller's relationship to the row (owner / requester / member).
 */
import type { ActionTools } from 'deepspace/worker'
import { cityOf, placeKey, type PlaceReviewData } from '../lib/reviews'
import { TripError, createProposal, getTrip, listMembers, logActivity, requireMember, userNames, type StopData, type TripData } from './trips'
import { LIMITS, reserve, type Limit } from './limits.js'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const today = () => new Date().toISOString().slice(0, 10)

export const VIBES = ['Foodie', 'Chill', 'Adventure', 'Culture', 'Nightlife', 'Nature', 'Budget', 'Photography', 'Solo-friendly'] as const
export const REQUESTS_PER_DAY = 20

type JoinRequest = {
  tripId: string
  tripTitle: string
  destination: string
  startDate: string
  endDate: string
  requesterId: string
  ownerId: string
  participants: string[]
  pitch: string
  status: 'pending' | 'accepted' | 'declined'
  lastMessageAt: string
}

function ok<T>(r: { success: boolean; data?: T; error?: string }, what: string): T {
  if (!r.success) throw new TripError(`${what} failed: ${r.error}`)
  return r.data as T
}

export async function tripOwnerId(tools: ActionTools, tripId: string, trip?: { createdBy?: string }) {
  const members = await listMembers(tools, tripId)
  return members.find((m) => m.data.role === 'owner')?.data.userId ?? trip?.createdBy ?? ''
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function saveProfile(tools: ActionTools, userId: string, p: Record<string, unknown>) {
  const interests = Array.isArray(p.interests) ? p.interests.map((x) => str(x, 30)).filter(Boolean).slice(0, 12) : []
  const data = {
    displayName: str(p.displayName, 60),
    avatarEmoji: str(p.avatarEmoji, 8) || '🧳',
    homeCity: str(p.homeCity, 80),
    bio: str(p.bio, 400),
    travelStyle: str(p.travelStyle, 40),
    interests,
    languages: str(p.languages, 120),
  }
  const existing = await tools.query('profiles', { where: { userId }, limit: 1 })
  const row = existing.success ? existing.data.records[0] : undefined
  ok(row ? await tools.update('profiles', row.recordId, data) : await tools.create('profiles', { ...data, userId }), 'save profile')
  return { saved: true }
}

// ---------------------------------------------------------------------------
// Public listings
// ---------------------------------------------------------------------------

/** Rebuild the public snapshot for a trip (no-op when the trip is private). */
export async function refreshListing(tools: ActionTools, tripId: string, extra?: { description?: string; vibes?: string[]; openSpots?: number }) {
  const trip = await getTrip(tools, tripId)
  const existing = await tools.query<{ tripId: string }>('public_trips', { where: { tripId }, limit: 1 })
  const row = existing.success ? existing.data.records[0] : undefined
  if (!trip || (trip.data as TripData & { visibility?: string }).visibility !== 'public') {
    if (row) await tools.remove('public_trips', row.recordId)
    return null
  }
  const members = await listMembers(tools, tripId)
  const ownerId = members.find((m) => m.data.role === 'owner')?.data.userId ?? trip.createdBy ?? ''
  const names = await userNames(tools, [ownerId])
  const stops = await tools.query<StopData>('stops', { where: { tripId }, limit: 300 })
  const byDay = new Map<string, string[]>()
  for (const s of stops.success ? stops.data.records : []) {
    const list = byDay.get(s.data.date) ?? []
    list.push(s.data.title)
    byDay.set(s.data.date, list)
  }
  const highlights = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 7).map(([date, titles]) => ({ date, titles: titles.slice(0, 4) }))
  const t = trip.data
  const data: Record<string, unknown> = {
    tripId,
    ownerId,
    hostName: names[ownerId]?.name ?? 'Traveler',
    title: t.title,
    destination: t.destination,
    lat: t.lat,
    lng: t.lng,
    startDate: t.startDate,
    endDate: t.endDate,
    memberCount: members.length,
    highlights,
  }
  if (extra?.description !== undefined) data.description = extra.description
  if (extra?.vibes !== undefined) data.vibes = extra.vibes
  if (extra?.openSpots !== undefined) data.openSpots = extra.openSpots
  if (row) ok(await tools.update('public_trips', row.recordId, data), 'update listing')
  else ok(await tools.create('public_trips', { description: '', vibes: [], openSpots: 2, ...data }), 'create listing')
  return { listed: true }
}

export async function setVisibility(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const tripId = str(params.tripId, 80)
  const { trip } = await requireMember(tools, tripId, userId)
  if ((await tripOwnerId(tools, tripId, trip)) !== userId) throw new TripError('Only the trip organizer can change visibility')
  const visibility = params.visibility === 'public' ? 'public' : 'private'
  ok(await tools.update('trips', tripId, { visibility }), 'update trip')
  const vibes = Array.isArray(params.vibes) ? params.vibes.filter((v): v is string => (VIBES as readonly string[]).includes(String(v))).slice(0, 5) : []
  const spots = Math.max(0, Math.min(20, Math.round(Number(params.openSpots ?? 2)) || 0))
  await refreshListing(tools, tripId, visibility === 'public' ? { description: str(params.description, 500), vibes, openSpots: spots } : undefined)
  await logActivity(tools, tripId, userId, visibility === 'public' ? 'made the trip public on Discover' : 'made the trip private')
  return { visibility }
}

// ---------------------------------------------------------------------------
// Join requests + request thread
// ---------------------------------------------------------------------------

async function bumpDailyCounter(tools: ActionTools, userId: string, limit: Limit) {
  const r = await reserve(tools, userId, limit)
  if (!r.ok) throw new TripError(r.error)
}

export async function requestToJoin(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const tripId = str(params.tripId, 80)
  const pitch = str(params.pitch, 600)
  if (pitch.length < 10) throw new TripError('Say a little about yourself (at least 10 characters)')
  const trip = await getTrip(tools, tripId)
  if (!trip || (trip.data as TripData & { visibility?: string }).visibility !== 'public') throw new TripError('This trip is not open to requests')
  const members = await listMembers(tools, tripId)
  if (members.some((m) => m.data.userId === userId)) throw new TripError('You are already on this trip')
  const listing = await tools.query<{ openSpots?: number }>('public_trips', { where: { tripId }, limit: 1 })
  if (listing.success && Number(listing.data.records[0]?.data.openSpots ?? 1) <= 0) throw new TripError('This trip is full')
  const ownerId = members.find((m) => m.data.role === 'owner')?.data.userId ?? trip.createdBy ?? ''
  const prior = await tools.query<JoinRequest>('join_requests', { where: { tripId, requesterId: userId }, limit: 5 })
  // One request per trip, ever: a declined request can't be re-sent to pester the host.
  if (prior.success && prior.data.records.length > 0) throw new TripError('You already asked to join this trip')
  await bumpDailyCounter(tools, userId, { ...LIMITS.requests, cap: REQUESTS_PER_DAY })

  const now = new Date().toISOString()
  const participants = [userId, ownerId]
  const t = trip.data
  const req = ok(
    await tools.create('join_requests', {
      tripId, tripTitle: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate,
      requesterId: userId, ownerId, participants, pitch, status: 'pending', lastMessageAt: now,
    } satisfies JoinRequest),
    'create request',
  )
  await tools.create('dm_messages', { requestId: req.recordId, participants, senderId: userId, text: pitch })

  // Heads-up email to the organizer (best effort).
  const names = await userNames(tools, [userId, ownerId])
  const to = names[ownerId]?.email
  if (to) {
    await tools.integration('email/send', {
      to,
      subject: `${names[userId]?.name ?? 'A traveler'} wants to join ${t.title}`,
      html: `<p><b>${escapeHtml(names[userId]?.name ?? 'A traveler')}</b> asked to join <b>${escapeHtml(t.title)}</b>:</p><blockquote>${escapeHtml(pitch)}</blockquote><p>Open your TripHive inbox to accept or decline.</p>`,
    })
  }
  return { requestId: req.recordId }
}

async function loadRequest(tools: ActionTools, requestId: string) {
  const r = await tools.get<JoinRequest>('join_requests', requestId)
  if (!r.success) throw new TripError('Request not found')
  return r.data.record
}

export async function respondToRequest(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const req = await loadRequest(tools, str(params.requestId, 80))
  if (req.data.ownerId !== userId) throw new TripError('Only the trip organizer can respond')
  if (req.data.status !== 'pending') throw new TripError(`Request already ${req.data.status}`)
  const accept = params.accept === true
  const now = new Date().toISOString()
  if (accept) {
    const trip = await getTrip(tools, req.data.tripId)
    if (!trip) throw new TripError('Trip no longer exists')
    const members = await listMembers(tools, req.data.tripId)
    if (!members.some((m) => m.data.userId === req.data.requesterId)) {
      const existing = await tools.query('team_members', { where: { teamId: req.data.tripId, userId: req.data.requesterId }, limit: 1 })
      const row = existing.success ? existing.data.records[0] : undefined
      ok(
        row
          ? await tools.update('team_members', row.recordId, { status: 'active', role: 'member' })
          : await tools.create('team_members', { teamId: req.data.tripId, userId: req.data.requesterId, status: 'active', role: 'member' }),
        'add member',
      )
    }
    const listing = await tools.query<{ openSpots?: number }>('public_trips', { where: { tripId: req.data.tripId }, limit: 1 })
    const lrow = listing.success ? listing.data.records[0] : undefined
    if (lrow) await tools.update('public_trips', lrow.recordId, { openSpots: Math.max(0, Number(lrow.data.openSpots ?? 1) - 1) })
    await refreshListing(tools, req.data.tripId)
    const names = await userNames(tools, [req.data.requesterId])
    await logActivity(tools, req.data.tripId, req.data.requesterId, `joined from Discover (welcome, ${names[req.data.requesterId]?.name ?? 'traveler'}!)`)
  }
  ok(await tools.update('join_requests', req.recordId, { status: accept ? 'accepted' : 'declined', lastMessageAt: now }), 'update request')
  await tools.create('dm_messages', {
    requestId: req.recordId,
    participants: req.data.participants,
    senderId: 'system',
    text: accept ? 'Request accepted — chat is unlocked and the trip is shared. Welcome aboard! 🎉' : 'Request declined.',
  })
  return { status: accept ? 'accepted' : 'declined' }
}

export async function sendDm(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const req = await loadRequest(tools, str(params.requestId, 80))
  const text = str(params.text, 1000)
  if (!text) throw new TripError('Message is empty')
  if (!req.data.participants.includes(userId)) throw new TripError('Not your conversation')
  if (req.data.status === 'declined') throw new TripError('This request was declined')
  // While pending, only the organizer can reply (the requester already sent their pitch).
  if (req.data.status === 'pending' && userId !== req.data.ownerId) throw new TripError('Chat unlocks when the organizer accepts')
  ok(await tools.create('dm_messages', { requestId: req.recordId, participants: req.data.participants, senderId: userId, text }), 'send')
  await tools.update('join_requests', req.recordId, { lastMessageAt: new Date().toISOString() })
  return { sent: true }
}

export async function sendTripMessage(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const tripId = str(params.tripId, 80)
  await requireMember(tools, tripId, userId)
  const text = str(params.text, 1000)
  if (!text) throw new TripError('Message is empty')
  ok(await tools.create('trip_messages', { tripId, senderId: userId, text }), 'send')
  return { sent: true }
}

/** Any member can suggest a stop; it becomes a proposal the group votes on. */
export async function suggestStop(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const tripId = str(params.tripId, 80)
  await requireMember(tools, tripId, userId)
  const stop = (params.stop ?? {}) as Partial<StopData>
  const names = await userNames(tools, [userId])
  return createProposal(tools, tripId, userId, {
    kind: 'add',
    stop,
    summary: `Add ${str(stop.title, 80)}${stop.start ? ` at ${stop.start}` : ''} on ${stop.date}`,
    reason: str(params.reason, 500) || `Suggested by ${names[userId]?.name ?? 'a traveler'}.`,
    sources: typeof stop.url === 'string' ? [stop.url] : [],
  })
}

const MAX_REVIEW_SPEND_USD = 10_000

/**
 * A member rates a place on their trip. One review per user per place: a
 * second review replaces the first. Reviews are public to signed-in users so
 * other TripHivers see them when adding the same place.
 */
export async function reviewPlace(tools: ActionTools, userId: string, params: Record<string, unknown>) {
  const tripId = str(params.tripId, 80)
  await requireMember(tools, tripId, userId)
  const trip = await getTrip(tools, tripId)
  if (!trip) throw new TripError('Trip not found')
  const name = str(params.name, 120)
  if (!name) throw new TripError('Which place?')
  const rating = Math.round(Number(params.rating))
  if (!(rating >= 1 && rating <= 5)) throw new TripError('Rating must be 1–5 stars')
  const spent = Number(params.spentUsd)
  const data = {
    placeKey: placeKey(name, trip.data.destination),
    name,
    city: cityOf(trip.data.destination),
    userId,
    tripId,
    rating,
    text: str(params.text, 600) || undefined,
    spentUsd: Number.isFinite(spent) && spent >= 0 && spent <= MAX_REVIEW_SPEND_USD ? Math.round(spent) : undefined,
  }
  const prior = await tools.query<PlaceReviewData & Record<string, unknown>>('place_reviews', { where: { placeKey: data.placeKey, userId }, limit: 1 })
  const existing = prior.success ? prior.data.records[0] : undefined
  if (existing) ok(await tools.update('place_reviews', existing.recordId, data), 'update review')
  else ok(await tools.create('place_reviews', data), 'save review')
  await logActivity(tools, tripId, userId, `rated ${name} ${'★'.repeat(rating)}`)
  return { saved: true, placeKey: data.placeKey }
}

/** Remove social rows tied to a trip (called by deleteTrip). */
export async function deleteSocial(tools: ActionTools, tripId: string) {
  const reqs = await tools.query<JoinRequest>('join_requests', { where: { tripId }, limit: 500 })
  for (const r of reqs.success ? reqs.data.records : []) {
    await tools.deleteWhere('dm_messages', { requestId: r.recordId }, 500)
    await tools.remove('join_requests', r.recordId)
  }
  await tools.deleteWhere('trip_messages', { tripId }, 500)
  await tools.deleteWhere('public_trips', { tripId }, 10)
}

const DELETE_PAGE = 500
const MAX_DELETE_PAGES = 20

/**
 * Delete a trip and everything hanging off it. Shared by deleteTrip and the
 * owner-only demo reset; callers do their own authorization.
 */
export async function purgeTrip(tools: ActionTools, tripId: string) {
  for (const coll of ['stops', 'prefs', 'issues', 'proposals', 'activity'] as const) {
    for (let i = 0; i < MAX_DELETE_PAGES; i++) {
      const r = await tools.deleteWhere(coll, { tripId }, DELETE_PAGE)
      if (!r.success || (r.data as { deleted: number }).deleted < DELETE_PAGE) break
    }
  }
  await deleteSocial(tools, tripId)
  await tools.deleteWhere('team_members', { teamId: tripId }, DELETE_PAGE)
  await tools.remove('trips', tripId)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
