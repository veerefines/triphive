/**
 * Coordinates of the viewer's home city for the "getting there" estimate.
 * One OpenStreetMap Nominatim lookup per city, cached in localStorage.
 */
import { useEffect, useState } from 'react'
import type { LatLng } from '@/lib/geo'

const CACHE_PREFIX = 'triphive:home:'
const TIMEOUT_MS = 6000

async function geocode(city: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) return null
  const hit = ((await res.json()) as Array<{ lat?: string; lon?: string }>)[0]
  const lat = Number(hit?.lat)
  const lng = Number(hit?.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

export function useHomeCoords(city: string | null | undefined): LatLng | null {
  const [coords, setCoords] = useState<LatLng | null>(null)
  useEffect(() => {
    const q = city?.trim()
    if (!q) return setCoords(null)
    const key = CACHE_PREFIX + q.toLowerCase()
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? 'null') as LatLng | null
      if (cached) return setCoords(cached)
    } catch {
      /* corrupt cache: refetch */
    }
    let alive = true
    geocode(q)
      .then((c) => {
        if (!alive || !c) return
        localStorage.setItem(key, JSON.stringify(c))
        setCoords(c)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [city])
  return coords
}
