/**
 * Trip domain service — the one place that touches trip data with elevated
 * privileges. Used by server actions (src/actions) and by Hive's tools
 * (src/ai/trip-tools.ts).
 *
 * Every function receives `ActionTools`, which run RBAC-OFF (X-App-Action).
 * That is why each entry point checks trip membership itself via
 * `requireMember` before reading or writing anything for the caller.
 */
import type { ActionTools } from 'deepspace/worker'
import { googlePlacesSearch } from './google'
import { checkPlan, summarizeForecast, tripDates, type DayForecast, type Issue, type PrefLike, type StopLike } from '../lib/planCheck'
import { LIMITS, reserve } from './limits.js'
import { placeKey } from '../lib/reviews'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TripData = {
  title: string
  destination: string
  startDate: string
  endDate: string
  teamId: string
  inviteCode: string
  lat?: number
  lng?: number
  forecast?: Record<string, DayForecast> | null
  forecastAt?: string
  coverUrl?: string
}

export type StopData = {
  tripId: string
  date: string
  start?: string
  end?: string
  title: string
  notes?: string
  address?: string
  url?: string
  category?: string
  lat?: number
  lng?: number
  costPerPerson?: number
  outdoor?: boolean | number
  fixedTime?: boolean | number
  source?: 'human' | 'ai'
  rating?: number
  ratingCount?: number
}

export type ProposalData = {
  tripId: string
  kind: 'add' | 'update' | 'remove'
  payload: { stop?: Partial<StopData>; stopId?: string; patch?: Partial<StopData> }
  summary: string
  reason: string
  sources: string[]
  status: 'pending' | 'accepted' | 'rejected' | 'stale'
  votes: Record<string, 1 | -1>
  proposedFor: string
}

export class TripError extends Error {}

const STOP_FIELDS = [
  'date', 'start', 'end', 'title', 'notes', 'address', 'url', 'category',
  'lat', 'lng', 'costPerPerson', 'outdoor', 'fixedTime', 'rating', 'ratingCount',
] as const

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/
const YMD = /^\d{4}-\d{2}-\d{2}$/

function unwrap<T>(r: { success: boolean; data?: T; error?: string }, what: string): T {
  if (!r.success) throw new TripError(`${what} failed: ${r.error}`)
  return r.data as T
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function getTrip(tools: ActionTools, tripId: string) {
  const r = await tools.get<TripData>('trips', tripId)
  if (!r.success) return null
  return r.data.record
}

export async function listMembers(tools: ActionTools, tripId: string) {
  const r = unwrap(await tools.query<{ teamId: string; userId: string; status: string; role: string }>('team_members', { where: { teamId: tripId }, limit: 100 }), 'members')
  return r.records.filter((m) => m.data.status !== 'left')
}

/** Throws unless `userId` is an active member of the trip. Returns the trip. */
export async function requireMember(tools: ActionTools, tripId: string, userId: string) {
  if (typeof tripId !== 'string' || !tripId) throw new TripError('tripId is required')
  const trip = await getTrip(tools, tripId)
  if (!trip) throw new TripError('Trip not found')
  const members = await listMembers(tools, tripId)
  if (!members.some((m) => m.data.userId === userId)) throw new TripError('You are not a member of this trip')
  return { trip, members }
}

export async function userNames(tools: ActionTools, userIds: string[]): Promise<Record<string, { name: string; email?: string }>> {
  const out: Record<string, { name: string; email?: string }> = {}
  const r = await tools.query<{ name?: string; email?: string }>('users', { limit: 500 })
  if (!r.success) return out
  for (const u of r.data.records) {
    if (userIds.includes(u.recordId)) out[u.recordId] = { name: u.data.name || 'Traveler', email: u.data.email }
  }
  return out
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function logActivity(tools: ActionTools, tripId: string, actorId: string, text: string) {
  await tools.create('activity', { tripId, actorId, text })
}

// ---------------------------------------------------------------------------
// Trip lifecycle
// ---------------------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function inviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export async function createTrip(
  tools: ActionTools,
  userId: string,
  input: { title?: unknown; destination?: unknown; startDate?: unknown; endDate?: unknown },
) {
  const title = String(input.title ?? '').trim().slice(0, 80)
  const destination = String(input.destination ?? '').trim().slice(0, 80)
  const startDate = String(input.startDate ?? '')
  const endDate = String(input.endDate ?? '')
  if (!title || !destination) throw new TripError('Title and destination are required')
  if (!YMD.test(startDate) || !YMD.test(endDate) || endDate < startDate) throw new TripError('Invalid dates')
  if (tripDates(startDate, endDate).length > 21) throw new TripError('Trips are limited to 21 days')

  // OWM knows cities; fall back to OSM for regions/landmarks ("Meghalaya", "Amalfi Coast").
  const coords = (await geocodeCity(tools, destination)) ?? (await geocodePlace(destination, undefined, 1).then((h) => (h[0] ? { lat: h[0].lat, lng: h[0].lng } : null)).catch(() => null))
  const tripId = `trip_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  unwrap(
    await tools.create('trips', {
      title, destination, startDate, endDate,
      teamId: tripId,
      inviteCode: inviteCode(),
      ...(coords ?? {}),
    }, tripId),
    'create trip',
  )
  unwrap(await tools.create('team_members', { teamId: tripId, userId, status: 'active', role: 'owner' }), 'add owner')
  await logActivity(tools, tripId, userId, `created the trip to ${destination}`)
  // Weather is best-effort; a forecast only exists for the next 5 days anyway.
  await refreshWeather(tools, tripId).catch(() => undefined)
  return { tripId }
}

export async function joinTrip(tools: ActionTools, userId: string, code: unknown) {
  const inviteCode = String(code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(inviteCode)) throw new TripError('Invite codes are 6 letters/numbers')
  const r = unwrap(await tools.query<TripData>('trips', { where: { inviteCode }, limit: 1 }), 'lookup')
  const trip = r.records[0]
  if (!trip) throw new TripError('No trip with that code')
  const members = await listMembers(tools, trip.recordId)
  if (!members.some((m) => m.data.userId === userId)) {
    unwrap(await tools.create('team_members', { teamId: trip.recordId, userId, status: 'active', role: 'member' }), 'join')
    await logActivity(tools, trip.recordId, userId, 'joined the trip')
  }
  return { tripId: trip.recordId }
}

// ---------------------------------------------------------------------------
// Plan check (Hive's deterministic checks)
// ---------------------------------------------------------------------------

export function toStopLike(id: string, d: Partial<StopData>): StopLike {
  return {
    id,
    date: String(d.date ?? ''),
    start: d.start || undefined,
    end: d.end || undefined,
    title: String(d.title ?? ''),
    category: d.category,
    lat: typeof d.lat === 'number' ? d.lat : undefined,
    lng: typeof d.lng === 'number' ? d.lng : undefined,
    costPerPerson: typeof d.costPerPerson === 'number' ? d.costPerPerson : undefined,
    outdoor: !!d.outdoor,
    address: d.address,
  }
}

export async function loadPlan(tools: ActionTools, tripId: string) {
  const trip = await getTrip(tools, tripId)
  if (!trip) throw new TripError('Trip not found')
  const stops = unwrap(await tools.query<StopData>('stops', { where: { tripId }, limit: 500 }), 'stops').records
  const prefRows = unwrap(await tools.query<PrefLike & { tripId: string }>('prefs', { where: { tripId }, limit: 100 }), 'prefs').records
  const names = await userNames(tools, prefRows.map((p) => p.data.userId))
  const prefs: PrefLike[] = prefRows.map((p) => ({ ...p.data, name: names[p.data.userId]?.name }))
  return { trip, stops, prefs }
}

/** Recompute issues and replace the trip's `issues` rows. */
export async function runPlanCheck(tools: ActionTools, tripId: string): Promise<Issue[]> {
  const { trip, stops, prefs } = await loadPlan(tools, tripId)
  const issues = checkPlan(
    { startDate: trip.data.startDate, endDate: trip.data.endDate, forecast: trip.data.forecast ?? null },
    stops.map((s) => toStopLike(s.recordId, s.data)),
    prefs,
  )
  // Drain old issues, then write the fresh set.
  for (let i = 0; i < 10; i++) {
    const del = await tools.deleteWhere('issues', { tripId }, 500)
    if (!del.success || (del.data as { deleted: number }).deleted < 500) break
  }
  for (const issue of issues) await tools.create('issues', { tripId, ...issue })
  return issues
}

// ---------------------------------------------------------------------------
// External data: geocoding, weather, places
// ---------------------------------------------------------------------------

/** City-level geocoding via the DeepSpace OpenWeatherMap integration. */
export async function geocodeCity(tools: ActionTools, q: string): Promise<{ lat: number; lng: number } | null> {
  const r = await tools.integration<Array<{ lat: number; lon: number }>>('openweathermap/geocoding', { q, limit: 1 })
  if (!r.success || !Array.isArray(r.data) || !r.data[0]) return null
  return { lat: r.data[0].lat, lng: r.data[0].lon }
}

export interface PlaceHit {
  name: string
  address: string
  lat: number
  lng: number
  kind: string
  rating?: number
  ratingCount?: number
  mapsUrl?: string
  openNow?: boolean
  source?: 'google' | 'osm'
}

/**
 * POI geocoding via OpenStreetMap Nominatim (free, keyless). The DeepSpace
 * catalog's Google Maps endpoint (serpapi/places-search) returned an upstream
 * quota error during development, and OWM geocoding is city-level only.
 * Results are biased (not bounded) to the area around the trip destination.
 * Nominatim's usage policy is max 1 request/second — callers geocode sequentially.
 */
export async function geocodePlace(query: string, near?: { lat?: number; lng?: number }, limit = 3): Promise<PlaceHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', String(Math.min(5, Math.max(1, limit))))
  if (typeof near?.lat === 'number' && typeof near?.lng === 'number') {
    // Prefer (not require) results near the trip: regions like "Meghalaya"
    // span far more than a city box.
    const d = 0.6
    url.searchParams.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
    url.searchParams.set('bounded', '0')
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'TripHive/1.0 (DeepSpace demo app)', 'Accept-Language': 'en' } })
  if (!res.ok) return []
  const rows = (await res.json()) as Array<{ name?: string; display_name: string; lat: string; lon: string; type?: string }>
  return rows.map((r) => ({
    name: r.name || r.display_name.split(',')[0],
    address: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
    kind: r.type ?? '',
  }))
}

/**
 * Returns a function that hands out the Google key for ONE lookup, reserving a
 * unit of LIMITS.places (src/server/limits.ts). Past the cap, or with no key
 * configured, it returns undefined → OSM fallback.
 */
export function googleGate(tools: ActionTools, userId: string, key: string | undefined) {
  return async (): Promise<string | undefined> => {
    if (!key) return undefined
    const r = await reserve(tools, userId, LIMITS.places)
    return r.ok ? key : undefined
  }
}

/**
 * Best available place lookup: Google Places (ratings, Maps link) when the
 * owner configured GOOGLE_MAPS_API_KEY, otherwise OpenStreetMap — first
 * biased to the trip area, then with the destination appended.
 */
export async function findPlaces(
  googleKey: string | undefined,
  query: string,
  trip: { lat?: number; lng?: number; destination: string },
  limit = 3,
): Promise<PlaceHit[]> {
  const g = await googlePlacesSearch(googleKey, `${query}, ${trip.destination}`, trip, limit).catch(() => null)
  if (g && g.length) return g.map((p) => ({ ...p, kind: p.kind ?? '', source: 'google' as const }))
  // Nominatim's free-text search is literal: "Ward's Lake, Shillong" finds
  // nothing while "Wards Lake" does. Try a few cleaned variants, biased to the
  // trip area, 1 request/second (usage policy), stopping at the first hit.
  const clean = (q: string) => q.replace(/['’`]/g, '').replace(/\s+/g, ' ').trim()
  const head = clean(query.split(',')[0])
  const variants = [...new Set([clean(query), head, `${head} ${trip.destination}`])].filter((v) => v.length >= 2)
  let hits: PlaceHit[] = []
  for (const [i, v] of variants.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100))
    hits = await geocodePlace(v, trip, limit).catch(() => [])
    if (hits.length) break
  }
  return hits.map((h) => ({ ...h, source: 'osm' as const }))
}

export async function refreshWeather(tools: ActionTools, tripId: string) {
  const trip = await getTrip(tools, tripId)
  if (!trip) throw new TripError('Trip not found')
  // Backfill coordinates for trips whose destination the city geocoder missed
  // (before the forecast call, which can fail for region names).
  if (typeof trip.data.lat !== 'number') {
    const hit = (await geocodePlace(trip.data.destination, undefined, 1).catch(() => []))[0]
    if (hit) {
      await tools.update('trips', tripId, { lat: hit.lat, lng: hit.lng })
      trip.data.lat = hit.lat
      trip.data.lng = hit.lng
    }
  }
  const r = await tools.integration<Array<{ dt: number; temp: number; description: string }>>('openweathermap/forecast', {
    q: trip.data.destination,
    units: 'metric',
  })
  if (!r.success || !Array.isArray(r.data)) throw new TripError(`Weather unavailable: ${r.success ? 'bad response' : r.error}`)
  // Approximate local time from longitude (15° per hour) — the flattened
  // forecast does not carry the city's UTC offset.
  const tz = typeof trip.data.lng === 'number' ? Math.round(trip.data.lng / 15) * 3600 : 0
  const forecast = { ...(trip.data.forecast ?? {}), ...summarizeForecast(r.data, tz) }
  await tools.update('trips', tripId, { forecast, forecastAt: new Date().toISOString() })
  return forecast
}

export async function searchPlaces(tools: ActionTools, query: string, destination: string, numResults = 5) {
  const r = await tools.integration<{ results: Array<{ title: string; url: string; summary?: string }> }>('exa/search', {
    query: `${query} in ${destination}`,
    numResults: Math.min(8, Math.max(1, numResults)),
    type: 'auto',
    contents: {
      summary: { query: `List specific named places for "${query}" in ${destination}: name, neighborhood, typical hours, price level, why it is good.` },
    },
  })
  if (!r.success) throw new TripError(`Search failed: ${r.error}`)
  return r.data.results.map((x) => ({ title: x.title, url: x.url, summary: String(x.summary ?? '').slice(0, 1200) }))
}

// ---------------------------------------------------------------------------
// Proposals + voting
// ---------------------------------------------------------------------------

export function cleanStop(input: Partial<StopData>, partial: boolean): Partial<StopData> {
  const out: Record<string, unknown> = {}
  for (const k of STOP_FIELDS) {
    const v = (input as Record<string, unknown>)[k]
    if (v === undefined) continue
    out[k] = v
  }
  if (out.date !== undefined && !YMD.test(String(out.date))) throw new TripError(`Bad date "${out.date}" (YYYY-MM-DD)`)
  for (const k of ['start', 'end'] as const) {
    if (out[k] !== undefined && out[k] !== '' && !HHMM.test(String(out[k]))) throw new TripError(`Bad ${k} "${out[k]}" (HH:MM)`)
  }
  if (!partial && (!out.title || !out.date)) throw new TripError('A new stop needs a title and a date')
  if (out.url !== undefined && out.url !== '') {
    try {
      const u = new URL(String(out.url))
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
      out.url = u.toString()
    } catch {
      delete out.url // never persist non-http(s) links
    }
  }
  if (typeof out.title === 'string') out.title = out.title.slice(0, 120)
  if (typeof out.notes === 'string') out.notes = out.notes.slice(0, 1000)
  return out as Partial<StopData>
}

/** Same place on the same day: compared by folded name, so "Café X" and "cafe x" match. */
export function isSameStop(a: Pick<StopData, 'title' | 'date'>, b: Pick<StopData, 'title' | 'date'>): boolean {
  return a.date === b.date && placeKey(a.title, '') === placeKey(b.title, '')
}

/**
 * Create a stop unless the trip already has the same place on that day.
 * Every write path (manual add, Hive group chat, accepted proposals) goes
 * through here, so a repeated "add" from Hive or a double-click is a no-op.
 */
export async function addStopOnce(
  tools: ActionTools,
  tripId: string,
  stop: Partial<StopData>,
  source: 'ai' | 'human',
): Promise<{ stopId: string; isDuplicate: boolean }> {
  if (!stop.title || !stop.date) throw new TripError('A new stop needs a title and a date')
  const existing = await tools.query<StopData>('stops', { where: { tripId, date: stop.date } })
  if (!existing.success) throw new TripError(existing.error)
  const twin = existing.data.records.find((r) => isSameStop(r.data, { title: stop.title!, date: stop.date! }))
  if (twin) return { stopId: twin.recordId, isDuplicate: true }
  const r = await tools.create('stops', { ...stop, tripId, source })
  if (!r.success) throw new TripError(r.error)
  return { stopId: r.data.recordId, isDuplicate: false }
}

export async function createProposal(
  tools: ActionTools,
  tripId: string,
  proposedFor: string,
  input: { kind: string; stop?: Partial<StopData>; stopId?: string; patch?: Partial<StopData>; summary: string; reason: string; sources?: string[] },
) {
  const kind = input.kind
  let payload: ProposalData['payload']
  if (kind === 'add') {
    payload = { stop: cleanStop(input.stop ?? {}, false) }
  } else if (kind === 'update' || kind === 'remove') {
    if (!input.stopId) throw new TripError('stopId is required')
    const s = await tools.get<StopData>('stops', input.stopId)
    if (!s.success || s.data.record.data.tripId !== tripId) throw new TripError('Stop not found on this trip')
    payload = kind === 'update' ? { stopId: input.stopId, patch: cleanStop(input.patch ?? {}, true) } : { stopId: input.stopId }
    if (kind === 'update' && Object.keys(payload.patch ?? {}).length === 0) throw new TripError('Empty patch')
  } else throw new TripError(`Unknown kind "${kind}"`)

  const sources = (input.sources ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, 5)
  const r = unwrap(
    await tools.create('proposals', {
      tripId, kind, payload,
      summary: String(input.summary ?? '').slice(0, 200),
      reason: String(input.reason ?? '').slice(0, 1000),
      sources,
      status: 'pending',
      votes: {},
      proposedFor,
    } satisfies ProposalData),
    'create proposal',
  )
  return { proposalId: r.recordId }
}

/**
 * Record a vote. Majority of members 👍 applies the proposal; majority 👎
 * rejects it. The trip owner can `force` either outcome.
 */
export async function voteOnProposal(tools: ActionTools, userId: string, proposalId: string, value: number, force = false) {
  const p = await tools.get<ProposalData>('proposals', proposalId)
  if (!p.success) throw new TripError('Proposal not found')
  const proposal = p.data.record
  const { trip, members } = await requireMember(tools, proposal.data.tripId, userId)
  if (proposal.data.status !== 'pending') return { status: proposal.data.status }

  const v: 1 | -1 = value >= 0 ? 1 : -1
  const votes = { ...(proposal.data.votes ?? {}), [userId]: v }
  const yes = Object.values(votes).filter((x) => x === 1).length
  const no = Object.values(votes).filter((x) => x === -1).length
  const n = members.length
  const isOwner = members.some((m) => m.data.userId === userId && m.data.role === 'owner') || trip.createdBy === userId

  let status: ProposalData['status'] = 'pending'
  if ((force && isOwner && v === 1) || yes > n / 2) status = 'accepted'
  else if ((force && isOwner && v === -1) || no >= Math.ceil(n / 2)) status = 'rejected'

  await tools.update('proposals', proposalId, { votes })
  if (status === 'accepted') {
    const applied = await applyProposal(tools, proposal.data)
    await tools.update('proposals', proposalId, { status: applied ? 'accepted' : 'stale' })
    await logActivity(tools, proposal.data.tripId, userId, applied
      ? `${force ? 'approved' : 'tipped the vote on'} Hive's suggestion: ${proposal.data.summary}`
      : `tried to apply "${proposal.data.summary}" but the stop changed since — marked stale`)
    await runPlanCheck(tools, proposal.data.tripId)
    return { status: applied ? 'accepted' : 'stale' }
  }
  if (status === 'rejected') {
    await tools.update('proposals', proposalId, { status })
    await logActivity(tools, proposal.data.tripId, userId, `rejected Hive's suggestion: ${proposal.data.summary}`)
  }
  return { status, yes, no, members: n }
}

/** Apply an accepted proposal. Returns false if the target stop is gone/moved. */
async function applyProposal(tools: ActionTools, p: ProposalData): Promise<boolean> {
  if (p.kind === 'add' && p.payload.stop) {
    await addStopOnce(tools, p.tripId, p.payload.stop, 'ai')
    return true
  }
  if (!p.payload.stopId) return false
  const s = await tools.get<StopData>('stops', p.payload.stopId)
  if (!s.success || s.data.record.data.tripId !== p.tripId) return false
  if (p.kind === 'remove') return (await tools.remove('stops', p.payload.stopId)).success
  if (p.kind === 'update' && p.payload.patch) return (await tools.update('stops', p.payload.stopId, p.payload.patch)).success
  return false
}
