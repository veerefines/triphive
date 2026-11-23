/**
 * Place photos for HiveCards, the Board, map peeks and the PDF.
 *
 * Google Places (New) first: Text Search returns photo resource names, and
 * the media endpoint with `skipHttpRedirect=true` returns a keyless
 * googleusercontent `photoUri`, so the API key never reaches the browser.
 * Wikipedia (no key) is the fallback. Results are cached in `place_photos`;
 * only cache misses spend the app-wide `LIMITS.photos` budget.
 */
import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { LIMITS, reserveAll } from './limits'
import { googleErrorReason } from './google'
import { TripError } from './trips'

export const MAX_PHOTOS = 4
const MAX_QUERIES = 16
const PHOTO_WIDTH = 800
const GOOGLE_TTL_MS = 12 * 60 * 60 * 1000 // photoUri links are not permanent
const WIKI_TTL_MS = 30 * 24 * 60 * 60 * 1000
const EMPTY_TTL_MS = 24 * 60 * 60 * 1000
/** A Wikipedia fallback row is retried against Google this often once a Google key exists. */
const WIKI_RETRY_WITH_GOOGLE_MS = 60 * 60 * 1000
const WIKI_CANDIDATES = 10
/** A Wikipedia match farther than this from the trip location is some other place. */
const WIKI_MAX_DISTANCE_KM = 150
/** Nearby-landmark fallback search radius (Wikipedia geosearch maximum is 10 km). */
const WIKI_NEARBY_RADIUS_M = 10_000
/**
 * Bumped when the lookup rules change, so cached picks made under the old
 * rules (e.g. portraits from free-text search) are fetched again.
 */
const CACHE_VERSION = 'v2'
/** Short descriptions of articles about people, events and organisations rather than places. */
const NOT_A_PLACE = /\b(politician|actor|actress|singer|musician|player|footballer|cricketer|writer|author|poet|businessman|businesswoman|journalist|minister|president|king|queen|prince|princess|born|died|election|summit|treaty|meeting|conference|war|battle|film|album|song|band|television|series|novel|party|organi[sz]ation|company|union)\b/i
/**
 * Wikipedia article images are often locator maps, flags or seals rather
 * than photos of the place. Filenames give them away.
 */
const NOT_A_PHOTO = /(^|[^a-z])(map|maps|locator|location|karte|carte|mapa|flag|flags|coat[_ ]of[_ ]arms|emblem|seal|logo\w*|relief|topograph\w*|districts?|administrative|boundar\w*|diagram|chart|icon|symbol)([^a-z]|$)|\.svg/i
const WIKIMEDIA_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org'])
const WIKIMEDIA_PHOTO_EXT = /\.(jpe?g|webp)$/i
const FETCH_TIMEOUT_MS = 6000
const WIKI_UA = 'TripHive/1.0 (https://triphive.app.space)'

export const photoQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  near: z.string().trim().max(80).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  max: z.number().int().min(1).max(MAX_PHOTOS).optional(),
})
export type PhotoQuery = z.infer<typeof photoQuerySchema>

/** The batch shape is checked strictly; each query is checked on its own so one bad item cannot blank the rest. */
const paramsSchema = z.object({ queries: z.array(z.unknown()).min(1).max(MAX_QUERIES) })

type Source = 'google' | 'wikipedia' | 'none'
interface PhotoSet {
  urls: string[]
  source: Source
}

/**
 * Cache key: normalized "query|near|max|lat,lng". The location bias changes
 * which place Google returns, so it is part of the key (rounded to ~11 km)
 * and one caller's bias cannot poison another's entry.
 */
export function photoKey(q: PhotoQuery): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const hasBias = typeof q.lat === 'number' && typeof q.lng === 'number'
  const bias = hasBias ? `${q.lat!.toFixed(1)},${q.lng!.toFixed(1)}` : ''
  return `${CACHE_VERSION}|${norm(q.q)}|${norm(q.near ?? '')}|${q.max ?? 1}|${bias}`
}

/** Bias rounded to the key's precision, so every caller sharing a key sends the same request. */
function canonicalBias(q: PhotoQuery): PhotoQuery {
  if (typeof q.lat !== 'number' || typeof q.lng !== 'number') return { ...q, lat: undefined, lng: undefined }
  return { ...q, lat: Number(q.lat.toFixed(1)), lng: Number(q.lng.toFixed(1)) }
}

/** True for map, flag, seal and SVG images that should never be shown as a place photo. */
export function isMapLikeImage(url: string): boolean {
  try {
    return NOT_A_PHOTO.test(decodeURIComponent(new URL(url).pathname))
  } catch {
    return true
  }
}

/** Allowed host and an actual photo. */
function isUsablePhoto(url: string): boolean {
  return isAllowedPhotoUrl(url) && !isMapLikeImage(url)
}

/** Only https photo URLs from the CDNs we resolve to are passed to the client. */
export function isAllowedPhotoUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    if (u.hostname.endsWith('.googleusercontent.com')) return true
    // Wikimedia serves photos as JPEG/WebP; PNG and SVG files there are logos, maps and diagrams.
    return WIKIMEDIA_HOSTS.has(u.hostname) && WIKIMEDIA_PHOTO_EXT.test(decodeURIComponent(u.pathname))
  } catch {
    return false
  }
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    console.error(`[photos] ${new URL(url).hostname} ${res.status}: ${await googleErrorReason(res)}`)
    return null
  }
  return (await res.json()) as T
}

async function googlePhotos(apiKey: string, q: PhotoQuery, max: number): Promise<string[]> {
  const body: Record<string, unknown> = { textQuery: q.near ? `${q.q}, ${q.near}` : q.q, maxResultCount: 1 }
  if (typeof q.lat === 'number' && typeof q.lng === 'number') {
    body.locationBias = { circle: { center: { latitude: q.lat, longitude: q.lng }, radius: 30_000 } }
  }
  const search = await fetchJson<{ places?: Array<{ photos?: Array<{ name?: string }> }> }>('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.photos' },
    body: JSON.stringify(body),
  })
  const names = (search?.places?.[0]?.photos ?? [])
    .map((p) => p.name)
    .filter((n): n is string => typeof n === 'string' && /^places\/[\w-]+\/photos\/[\w-]+$/.test(n))
    .slice(0, max)
  const uris = await Promise.all(
    names.map(async (name) => {
      const media = await fetchJson<{ photoUri?: string }>(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${PHOTO_WIDTH}&skipHttpRedirect=true`, {
        headers: { 'X-Goog-Api-Key': apiKey },
      }).catch(() => null)
      return media?.photoUri ?? ''
    }),
  )
  return uris.filter(isAllowedPhotoUrl)
}

type WikiPage = {
  index?: number
  thumbnail?: { source?: string }
  coordinates?: Array<{ lat?: number; lon?: number }>
  pageprops?: { 'wikibase-shortdesc'?: string }
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * True when a Wikipedia page is a real place worth showing: it is geotagged
 * (people, events and organisations are not), its description does not read
 * like a person or event, and it lies near the trip location when one is known.
 */
export function isPlacePage(page: WikiPage, q: Pick<PhotoQuery, 'lat' | 'lng'>): boolean {
  const at = page.coordinates?.[0]
  if (typeof at?.lat !== 'number' || typeof at?.lon !== 'number') return false
  if (NOT_A_PLACE.test(page.pageprops?.['wikibase-shortdesc'] ?? '')) return false
  if (typeof q.lat !== 'number' || typeof q.lng !== 'number') return true
  return distanceKm(q.lat, q.lng, at.lat, at.lon) <= WIKI_MAX_DISTANCE_KM
}

async function wikiPages(params: Record<string, string>): Promise<WikiPage[]> {
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'pageimages|coordinates|pageprops',
    piprop: 'thumbnail',
    pithumbsize: String(PHOTO_WIDTH),
    ppprop: 'wikibase-shortdesc',
    colimit: 'max',
    origin: '*',
    ...params,
  })
  const data = await fetchJson<{ query?: { pages?: Record<string, WikiPage> } }>(`https://en.wikipedia.org/w/api.php?${query}`, {
    headers: { 'User-Agent': WIKI_UA },
  })
  return Object.values(data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
}

function photosOf(pages: WikiPage[], q: PhotoQuery, max: number): string[] {
  return pages
    .filter((p) => isPlacePage(p, q))
    .map((p) => p.thumbnail?.source ?? '')
    .filter(isUsablePhoto)
    .slice(0, max)
}

/**
 * Wikipedia fallback (no key). Name search first, kept only for geotagged
 * place articles; then landmarks around the coordinates, so a restaurant
 * without an article still shows its neighbourhood rather than nothing.
 */
async function wikipediaPhotos(q: PhotoQuery, max: number): Promise<string[]> {
  const byName = photosOf(
    await wikiPages({ generator: 'search', gsrsearch: q.near ? `${q.q} ${q.near}` : q.q, gsrlimit: String(Math.max(WIKI_CANDIDATES, max)) }),
    q,
    max,
  )
  if (byName.length >= max || typeof q.lat !== 'number' || typeof q.lng !== 'number') return byName
  const nearby = photosOf(
    await wikiPages({ generator: 'geosearch', ggscoord: `${q.lat}|${q.lng}`, ggsradius: String(WIKI_NEARBY_RADIUS_M), ggslimit: String(WIKI_CANDIDATES) }),
    q,
    max,
  )
  return [...new Set([...byName, ...nearby])].slice(0, max)
}

async function lookup(googleKey: string | undefined, q: PhotoQuery): Promise<PhotoSet> {
  const max = q.max ?? 1
  if (googleKey) {
    const urls = await googlePhotos(googleKey, q, max).catch((err) => {
      console.error(`[photos] google failed: ${(err as Error).message}`)
      return []
    })
    if (urls.length) return { urls, source: 'google' }
  }
  const urls = await wikipediaPhotos(q, max).catch(() => [])
  return urls.length ? { urls, source: 'wikipedia' } : { urls: [], source: 'none' }
}

type CacheRow = { recordId: string; urls: string[]; source: Source; fetchedAt: number }

function isFresh(row: CacheRow, now: number, hasGoogle: boolean): boolean {
  if (row.source !== 'none' && row.urls.length === 0) return false // every cached url was filtered out
  if (hasGoogle && row.source === 'wikipedia' && now - row.fetchedAt >= WIKI_RETRY_WITH_GOOGLE_MS) return false
  const ttl = row.source === 'google' ? GOOGLE_TTL_MS : row.source === 'wikipedia' ? WIKI_TTL_MS : EMPTY_TTL_MS
  return now - row.fetchedAt < ttl
}

async function readCache(tools: ActionTools, key: string): Promise<CacheRow | null> {
  const r = await tools.query<{ urls?: string[]; source?: Source; fetchedAt?: number }>('place_photos', { where: { placeKey: key }, limit: 1 })
  const row = r.success ? r.data.records[0] : undefined
  if (!row) return null
  const urls = Array.isArray(row.data.urls) ? row.data.urls.filter((u): u is string => typeof u === 'string' && isUsablePhoto(u)) : []
  return { recordId: row.recordId, urls, source: row.data.source ?? 'none', fetchedAt: Number(row.data.fetchedAt ?? 0) }
}

async function writeCache(tools: ActionTools, key: string, existing: CacheRow | null, set: PhotoSet, now: number): Promise<void> {
  const data = { urls: set.urls, source: set.source, fetchedAt: now }
  const res = existing ? await tools.update('place_photos', existing.recordId, data) : await tools.create('place_photos', { placeKey: key, ...data })
  if (!res.success) console.error(`[photos] cache write failed for ${JSON.stringify(key)}`)
}

type Miss = { key: string; query: PhotoQuery; stale: CacheRow | null }

/**
 * `placePhotos` action: one photo list per query, in order.
 * Cache hits are free. All misses in the batch are reserved in ONE call
 * (units = distinct misses) before any lookup runs, so a batch cannot fan
 * out concurrent reservations past the cap.
 */
export async function placePhotos(tools: ActionTools, userId: string, googleKey: string | undefined, params: unknown): Promise<{ photos: string[][] }> {
  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) throw new TripError('Bad photo request')
  const now = Date.now()
  const queries = parsed.data.queries.map((raw) => {
    const q = photoQuerySchema.safeParse(raw)
    return q.success ? canonicalBias(q.data) : null
  })
  const keys = queries.map((q) => (q ? photoKey(q) : null))
  const distinct = [...new Set(keys.filter((k): k is string => k !== null))]

  const cached = new Map(await Promise.all(distinct.map(async (k) => [k, await readCache(tools, k).catch(() => null)] as const)))
  const misses: Miss[] = distinct
    .filter((k) => { const row = cached.get(k); return !row || !isFresh(row, now, !!googleKey) })
    .map((k) => ({ key: k, query: queries[keys.indexOf(k)]!, stale: cached.get(k) ?? null }))

  const results = new Map<string, string[]>(distinct.map((k) => [k, cached.get(k)?.urls ?? []]))
  if (misses.length) {
    const budget = await reserveAll(tools, [['app', LIMITS.photos], [userId, LIMITS.photosUser]], misses.length)
    if (budget.ok) {
      await Promise.all(
        misses.map(async (m) => {
          try {
            const set = await lookup(googleKey, m.query)
            await writeCache(tools, m.key, m.stale, set, now)
            results.set(m.key, set.urls)
          } catch (err) {
            console.error(`[photos] lookup failed: ${(err as Error).message}`)
          }
        }),
      )
    } // over budget: stale urls (already in results) beat nothing
  }
  return { photos: keys.map((k) => (k ? results.get(k) ?? [] : [])) }
}
