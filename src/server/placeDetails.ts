/**
 * Rich place details for the map peek and the expanded place sheet: Google
 * review snippets, editorial summary, opening hours, website and phone.
 * Google Places (New) Text Search with an extended field mask; cached in the
 * server-only `place_details` collection so repeat hovers cost nothing.
 * Only cache misses spend the caller's `LIMITS.places` budget.
 */
import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { placeKey } from '../lib/reviews'
import { LIMITS, reserve } from './limits'
import { TripError } from './trips'

const DETAILS_TTL_MS = 24 * 60 * 60 * 1000
const EMPTY_TTL_MS = 6 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 6000
const MAX_REVIEWS = 5
const MAX_REVIEW_CHARS = 600
const MAX_HOURS_LINES = 7
const SEARCH_RADIUS_M = 40_000

const FIELDS = [
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.priceLevel',
  'places.primaryTypeDisplayName',
  'places.editorialSummary',
  'places.currentOpeningHours.openNow',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.reviews',
].join(',')

export interface PlaceReviewSnippet {
  author: string
  rating: number | null
  text: string
  when: string
}

export interface PlaceDetails {
  name: string
  kind?: string
  address?: string
  summary?: string
  rating?: number
  ratingCount?: number
  priceLevel?: string
  openNow?: boolean
  hours: string[]
  website?: string
  phone?: string
  mapsUrl?: string
  reviews: PlaceReviewSnippet[]
}

const paramsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  destination: z.string().trim().max(160).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const clean = v.replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, max) : undefined
}

/** Only plain https/http links leave the server (no javascript:, data:, …). */
export function safeWebUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

type RawReview = {
  rating?: unknown
  text?: { text?: unknown }
  originalText?: { text?: unknown }
  relativePublishTimeDescription?: unknown
  authorAttribution?: { displayName?: unknown }
}

type RawPlace = {
  displayName?: { text?: unknown }
  formattedAddress?: unknown
  rating?: unknown
  userRatingCount?: unknown
  googleMapsUri?: unknown
  websiteUri?: unknown
  nationalPhoneNumber?: unknown
  priceLevel?: unknown
  primaryTypeDisplayName?: { text?: unknown }
  editorialSummary?: { text?: unknown }
  currentOpeningHours?: { openNow?: unknown }
  regularOpeningHours?: { weekdayDescriptions?: unknown }
  reviews?: unknown
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function parseReview(r: RawReview): PlaceReviewSnippet | null {
  const body = text(r.text?.text ?? r.originalText?.text, MAX_REVIEW_CHARS)
  if (!body) return null
  const rating = num(r.rating)
  return {
    author: text(r.authorAttribution?.displayName, 60) ?? 'Google user',
    rating: rating != null && rating >= 1 && rating <= 5 ? rating : null,
    text: body,
    when: text(r.relativePublishTimeDescription, 40) ?? '',
  }
}

/** Untrusted Google JSON → a bounded, typed PlaceDetails. */
export function parseGooglePlace(raw: RawPlace, fallbackName: string): PlaceDetails {
  const hours = Array.isArray(raw.regularOpeningHours?.weekdayDescriptions)
    ? raw.regularOpeningHours.weekdayDescriptions.map((h) => text(h, 80)).filter((h): h is string => !!h).slice(0, MAX_HOURS_LINES)
    : []
  const reviews = Array.isArray(raw.reviews)
    ? raw.reviews.map((r) => parseReview(r as RawReview)).filter((r): r is PlaceReviewSnippet => !!r).slice(0, MAX_REVIEWS)
    : []
  const openNow = raw.currentOpeningHours?.openNow
  return {
    name: text(raw.displayName?.text, 120) ?? fallbackName,
    kind: text(raw.primaryTypeDisplayName?.text, 60),
    address: text(raw.formattedAddress, 200),
    summary: text(raw.editorialSummary?.text, 400),
    rating: num(raw.rating),
    ratingCount: num(raw.userRatingCount),
    priceLevel: text(raw.priceLevel, 40),
    openNow: typeof openNow === 'boolean' ? openNow : undefined,
    hours,
    website: safeWebUrl(raw.websiteUri),
    phone: text(raw.nationalPhoneNumber, 40),
    mapsUrl: safeWebUrl(raw.googleMapsUri),
    reviews,
  }
}

type Query = z.infer<typeof paramsSchema>

async function fetchGoogle(apiKey: string, q: Query): Promise<PlaceDetails | null> {
  const body: Record<string, unknown> = { textQuery: q.destination ? `${q.name}, ${q.destination}` : q.name, maxResultCount: 1 }
  if (q.lat != null && q.lng != null) body.locationBias = { circle: { center: { latitude: q.lat, longitude: q.lng }, radius: SEARCH_RADIUS_M } }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`places details ${res.status}`)
  const data = (await res.json()) as { places?: RawPlace[] }
  const first = data.places?.[0]
  return first ? parseGooglePlace(first, q.name) : null
}

type CacheRow = { recordId: string; details: PlaceDetails | null; fetchedAt: number }

async function readCache(tools: ActionTools, key: string): Promise<CacheRow | null> {
  const r = await tools.query<{ data?: PlaceDetails | null; fetchedAt?: number }>('place_details', { where: { placeKey: key }, limit: 1 })
  const row = r.success ? r.data.records[0] : undefined
  if (!row) return null
  const details = row.data.data && typeof row.data.data === 'object' ? row.data.data : null
  return { recordId: row.recordId, details, fetchedAt: Number(row.data.fetchedAt ?? 0) }
}

async function writeCache(tools: ActionTools, key: string, existing: CacheRow | null, details: PlaceDetails | null, now: number): Promise<void> {
  const data = { data: details, fetchedAt: now }
  const res = existing ? await tools.update('place_details', existing.recordId, data) : await tools.create('place_details', { placeKey: key, ...data })
  if (!res.success) console.error(`[placeDetails] cache write failed for ${JSON.stringify(key)}`)
}

function isFresh(row: CacheRow, now: number): boolean {
  return now - row.fetchedAt < (row.details ? DETAILS_TTL_MS : EMPTY_TTL_MS)
}

/** `placeDetails` action. Returns `{ details: null }` when Google is not configured or has no match. */
export async function placeDetails(tools: ActionTools, userId: string, googleKey: string | undefined, params: unknown): Promise<{ details: PlaceDetails | null }> {
  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) throw new TripError('Bad place request')
  const q = parsed.data
  const key = placeKey(q.name, q.destination)
  const now = Date.now()
  const cached = await readCache(tools, key)
  if (cached && isFresh(cached, now)) return { details: cached.details }
  if (!googleKey) return { details: cached?.details ?? null }

  const budget = await reserve(tools, userId, LIMITS.places)
  if (!budget.ok) return { details: cached?.details ?? null } // stale beats nothing
  try {
    const details = await fetchGoogle(googleKey, q)
    await writeCache(tools, key, cached, details, now)
    return { details }
  } catch (err) {
    console.error(`[placeDetails] google failed: ${(err as Error).message}`)
    await budget.refund()
    return { details: cached?.details ?? null }
  }
}
