/**
 * Real street routing between two points via the public OSRM servers run by
 * FOSSGIS (routing.openstreetmap.de — CORS-enabled, no key). Results are
 * cached per hop; any failure returns null so callers fall back to the
 * haversine estimates in src/lib/legs.ts.
 */
import type { LatLng } from './geo'

export type RouteProfile = 'foot' | 'car'

export interface RoutedPath {
  /** [lat, lng] pairs, ready for Leaflet. */
  path: Array<[number, number]>
  minutes: number
  km: number
}

const OSRM_BASE: Record<RouteProfile, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
}
const TIMEOUT_MS = 6000
const MAX_CACHE = 300

const cache = new Map<string, Promise<RoutedPath | null>>()

const key = (profile: RouteProfile, a: LatLng, b: LatLng) =>
  `${profile}:${a.lat.toFixed(5)},${a.lng.toFixed(5)};${b.lat.toFixed(5)},${b.lng.toFixed(5)}`

/** Parse an OSRM /route response. Exported for tests. */
export function parseOsrm(json: unknown): RoutedPath | null {
  const route = (json as { code?: string; routes?: Array<{ geometry?: { coordinates?: unknown }; duration?: unknown; distance?: unknown }> })
    ?.routes?.[0]
  if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') return null
  const coords = route.geometry?.coordinates
  if (!Array.isArray(coords)) return null
  const path = coords
    .filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
    .map(([lng, lat]) => [lat, lng] as [number, number])
  if (path.length < 2) return null
  return { path, minutes: Math.max(1, Math.round(route.duration / 60)), km: Math.round(route.distance / 10) / 100 }
}

async function fetchRoute(profile: RouteProfile, a: LatLng, b: LatLng): Promise<RoutedPath | null> {
  const url = `${OSRM_BASE[profile]}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    return parseOsrm(await res.json())
  } catch {
    return null
  }
}

export function routeBetween(profile: RouteProfile, a: LatLng, b: LatLng): Promise<RoutedPath | null> {
  const k = key(profile, a, b)
  const hit = cache.get(k)
  if (hit) return hit
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
  const p = fetchRoute(profile, a, b).then((r) => {
    if (!r) cache.delete(k) // retry next time instead of pinning a failure
    return r
  })
  cache.set(k, p)
  return p
}
