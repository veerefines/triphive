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
import { TripError } from './trips'

export const MAX_PHOTOS = 4
const MAX_QUERIES = 16
const PHOTO_WIDTH = 800
const GOOGLE_TTL_MS = 12 * 60 * 60 * 1000 // photoUri links are not permanent
const WIKI_TTL_MS = 30 * 24 * 60 * 60 * 1000
const EMPTY_TTL_MS = 24 * 60 * 60 * 1000
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
  return `${norm(q.q)}|${norm(q.near ?? '')}|${q.max ?? 1}|${bias}`
}

/** Bias rounded to the key's precision, so every caller sharing a key sends the same request. */
function canonicalBias(q: PhotoQuery): PhotoQuery {
  if (typeof q.lat !== 'number' || typeof q.lng !== 'number') return { ...q, lat: undefined, lng: undefined }
  return { ...q, lat: Number(q.lat.toFixed(1)), lng: Number(q.lng.toFixed(1)) }
}

/** Only https image URLs from the two CDNs we resolve to are passed to the client. */
export function isAllowedPhotoUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname.endsWith('.googleusercontent.com') || u.hostname === 'upload.wikimedia.org')
  } catch {
    return false
  }
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    console.error(`[photos] ${new URL(url).hostname} ${res.status}`)
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

async function wikipediaPhotos(q: PhotoQuery, max: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: q.near ? `${q.q} ${q.near}` : q.q,
    gsrlimit: String(Math.max(3, max)),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(PHOTO_WIDTH),
    origin: '*',
  })
  const data = await fetchJson<{ query?: { pages?: Record<string, { index?: number; thumbnail?: { source?: string } }> } }>(
    `https://en.wikipedia.org/w/api.php?${params}`,
    { headers: { 'User-Agent': WIKI_UA } },
  )
  return Object.values(data?.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => p.thumbnail?.source ?? '')
    .filter(isAllowedPhotoUrl)
    .slice(0, max)
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

function isFresh(row: CacheRow, now: number): boolean {
  const ttl = row.source === 'google' ? GOOGLE_TTL_MS : row.source === 'wikipedia' ? WIKI_TTL_MS : EMPTY_TTL_MS
  return now - row.fetchedAt < ttl
}

async function readCache(tools: ActionTools, key: string): Promise<CacheRow | null> {
  const r = await tools.query<{ urls?: string[]; source?: Source; fetchedAt?: number }>('place_photos', { where: { placeKey: key }, limit: 1 })
  const row = r.success ? r.data.records[0] : undefined
  if (!row) return null
  const urls = Array.isArray(row.data.urls) ? row.data.urls.filter((u): u is string => typeof u === 'string' && isAllowedPhotoUrl(u)) : []
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
    .filter((k) => { const row = cached.get(k); return !row || !isFresh(row, now) })
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
