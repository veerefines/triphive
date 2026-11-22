/**
 * Travel-buddy matching: public trips near the same place whose dates overlap
 * a window of ±`windowDays` around mine. Pure, so it runs on the client
 * against the live `public_trips` listing and is unit-tested.
 */
import { haversineKm } from './geo'

export type TripWindow = {
  id?: string
  destination: string
  startDate: string
  endDate: string
  lat?: number
  lng?: number
}

export type Match<T> = { trip: T; overlapDays: number; gapDays: number; km: number | null }

const DAY = 86_400_000
const day = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY)
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(',')[0].trim()

/** True if a and b are in the same area: within `radiusKm`, or same city name when coordinates are missing. */
export function sameArea(a: TripWindow, b: TripWindow, radiusKm = 60): { near: boolean; km: number | null } {
  if (typeof a.lat === 'number' && typeof a.lng === 'number' && typeof b.lat === 'number' && typeof b.lng === 'number') {
    const km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
    return { near: km <= radiusKm, km }
  }
  return { near: norm(a.destination) === norm(b.destination), km: null }
}

/**
 * Days of real overlap (≥0) and the gap between ranges when they don't
 * overlap (0 when they do).
 */
export function dateRelation(a: TripWindow, b: TripWindow) {
  const as = day(a.startDate), ae = day(a.endDate), bs = day(b.startDate), be = day(b.endDate)
  const overlap = Math.min(ae, be) - Math.max(as, bs) + 1
  return { overlapDays: Math.max(0, overlap), gapDays: overlap > 0 ? 0 : 1 - overlap }
}

export function matchTrips<T extends TripWindow>(
  mine: TripWindow,
  listings: T[],
  opts: { radiusKm?: number; windowDays?: number; excludeIds?: string[] } = {},
): Match<T>[] {
  const { radiusKm = 60, windowDays = 5, excludeIds = [] } = opts
  const out: Match<T>[] = []
  for (const t of listings) {
    if (t.id && (t.id === mine.id || excludeIds.includes(t.id))) continue
    const area = sameArea(mine, t, radiusKm)
    if (!area.near) continue
    const rel = dateRelation(mine, t)
    if (rel.overlapDays === 0 && rel.gapDays > windowDays) continue
    out.push({ trip: t, overlapDays: rel.overlapDays, gapDays: rel.gapDays, km: area.km })
  }
  return out.sort((a, b) => b.overlapDays - a.overlapDays || a.gapDays - b.gapDays || (a.km ?? 0) - (b.km ?? 0))
}

export function matchLabel(m: { overlapDays: number; gapDays: number }) {
  if (m.overlapDays > 0) return `${m.overlapDays} day${m.overlapDays === 1 ? '' : 's'} overlap`
  return `${m.gapDays} day${m.gapDays === 1 ? '' : 's'} apart`
}
