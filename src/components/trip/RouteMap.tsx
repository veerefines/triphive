/**
 * Day route map — Leaflet + OpenStreetMap tiles (no API key). Numbered pins in
 * visit order and a dashed polyline; leg times are the same approximations
 * Plan Doctor uses (see src/lib/geo.ts).
 */
import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RecordData } from 'deepspace'
import { hasCoords, routeLegs, totalKm } from '@/lib/geo'
import { sortDay } from '@/lib/planCheck'
import { CATEGORY_META, type Stop, type Trip } from './types'

export function RouteMap({ trip, stops, date }: { trip: Trip; stops: RecordData<Stop>[]; date: string }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  const ordered = useMemo(
    () => sortDay(stops.filter((s) => s.data.date === date).map((s) => ({ ...s.data, id: s.recordId }))),
    [stops, date],
  )
  const located = ordered.filter(hasCoords)
  const legs = routeLegs(ordered)

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const pts: L.LatLngExpression[] = []
    located.forEach((s, i) => {
      const color = (CATEGORY_META[s.category ?? 'other'] ?? CATEGORY_META.other).color
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:600 12px Inter,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${i + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      const ll: L.LatLngExpression = [s.lat as number, s.lng as number]
      pts.push(ll)
      L.marker(ll, { icon })
        .bindTooltip(`${s.start ?? ''} ${s.title}`.trim())
        .addTo(g)
    })
    if (pts.length > 1) L.polyline(pts, { color: '#d97706', weight: 3, dashArray: '6 6' }).addTo(g)
    if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 })
    else if (typeof trip.lat === 'number' && typeof trip.lng === 'number') m.setView([trip.lat, trip.lng], 12)
    else m.setView([20, 0], 2)
  }, [located, trip.lat, trip.lng])

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[1fr_280px]">
      <div ref={el} className="min-h-[420px] overflow-hidden rounded-2xl border border-border" />
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <p className="font-display text-lg font-semibold">Route · {date}</p>
        <p className="mb-3 text-xs text-muted-foreground">
          {totalKm(ordered)} km total · approx (straight line ×1.3), not live transit
        </p>
        <ol className="space-y-2">
          {ordered.map((s, i) => {
            const leg = legs.find((l) => l.toIndex === i)
            return (
              <li key={s.id}>
                {leg && (
                  <p className="pl-6 text-[11px] text-muted-foreground">
                    {leg.mode === 'walk' ? '🚶' : '🚇'} {leg.minutes} min · {leg.km} km
                  </p>
                )}
                <p>
                  <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                    {hasCoords(s) ? located.indexOf(s) + 1 : '?'}
                  </span>
                  {s.start ?? '--:--'} {s.title}
                </p>
              </li>
            )
          })}
        </ol>
        {ordered.length > located.length && (
          <p className="mt-3 text-xs text-warning">{ordered.length - located.length} stop(s) have no location — open them and press search to pin.</p>
        )}
      </div>
    </div>
  )
}
