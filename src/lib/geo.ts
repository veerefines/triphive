/**
 * Geometry + routing helpers. No routing API is available on the DeepSpace
 * catalog, so travel times are straight-line (haversine) estimates scaled by a
 * detour factor and a mode speed. They are labelled "approx" in the UI.
 */

export type TravelMode = 'walk' | 'transit' | 'drive'

/** km/h, door-to-door averages for a city. */
export const MODE_SPEED_KMH: Record<TravelMode, number> = { walk: 4.5, transit: 18, drive: 25 }
/** Streets are not straight lines. */
const DETOUR = 1.3
/** Fixed overhead for transit/drive (waiting, parking). */
const MODE_OVERHEAD_MIN: Record<TravelMode, number> = { walk: 0, transit: 8, drive: 5 }

export interface LatLng {
  lat: number
  lng: number
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Best sensible mode for a distance: walk short hops, transit otherwise. */
export function pickMode(km: number): TravelMode {
  if (km <= 1.5) return 'walk'
  return 'transit'
}

export function travelMinutes(km: number, mode: TravelMode = pickMode(km)): number {
  if (km === 0) return 0
  return Math.round((km * DETOUR * 60) / MODE_SPEED_KMH[mode] + MODE_OVERHEAD_MIN[mode])
}

export interface Leg {
  fromIndex: number
  toIndex: number
  km: number
  mode: TravelMode
  minutes: number
}

export function hasCoords(p: Partial<LatLng> | undefined | null): p is LatLng {
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number' && !(p.lat === 0 && p.lng === 0)
}

/** Legs between consecutive points that both have coordinates. */
export function routeLegs(points: Array<Partial<LatLng>>, mode?: TravelMode): Leg[] {
  const legs: Leg[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!hasCoords(a) || !hasCoords(b)) continue
    const km = haversineKm(a, b)
    const m = mode ?? pickMode(km)
    legs.push({ fromIndex: i, toIndex: i + 1, km: Math.round(km * 100) / 100, mode: m, minutes: travelMinutes(km, m) })
  }
  return legs
}

/**
 * Nearest-neighbour ordering. `fixed` points (fixed-time stops) are anchors
 * that keep their position; the free points between two anchors are
 * reordered greedily starting from the previous anchor (or the first point).
 * Points without coordinates keep their relative order at the segment end.
 */
export function nearestNeighbourOrder<T extends Partial<LatLng> & { fixed?: boolean }>(points: T[]): T[] {
  const out: T[] = []
  let segment: T[] = []
  const flush = () => {
    const withC = segment.filter(hasCoords) as Array<T & LatLng>
    const without = segment.filter((p) => !hasCoords(p))
    let cursor: Partial<LatLng> | undefined = out[out.length - 1]
    if (!hasCoords(cursor) && withC.length) cursor = withC[0]
    while (withC.length) {
      let bestIdx = 0
      let best = Infinity
      withC.forEach((p, i) => {
        const d = hasCoords(cursor) ? haversineKm(cursor, p) : i
        if (d < best) {
          best = d
          bestIdx = i
        }
      })
      const [next] = withC.splice(bestIdx, 1)
      out.push(next)
      cursor = next
    }
    out.push(...without)
    segment = []
  }
  for (const p of points) {
    if (p.fixed) {
      flush()
      out.push(p)
    } else segment.push(p)
  }
  flush()
  return out
}

export function totalKm(points: Array<Partial<LatLng>>): number {
  return Math.round(routeLegs(points).reduce((s, l) => s + l.km, 0) * 10) / 10
}

/** Google Maps directions deep link (no API key). Up to 9 waypoints. */
export function googleDirectionsUrl(points: LatLng[], mode: TravelMode = 'walk'): string | null {
  if (points.length < 2) return null
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`
  const u = new URL('https://www.google.com/maps/dir/')
  u.searchParams.set('api', '1')
  u.searchParams.set('origin', fmt(points[0]))
  u.searchParams.set('destination', fmt(points[points.length - 1]))
  const mid = points.slice(1, -1).slice(0, 9)
  if (mid.length) u.searchParams.set('waypoints', mid.map(fmt).join('|'))
  u.searchParams.set('travelmode', mode === 'walk' ? 'walking' : mode === 'transit' ? 'transit' : 'driving')
  return u.toString()
}
