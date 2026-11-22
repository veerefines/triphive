/**
 * Day route map — Leaflet + OpenStreetMap tiles (no API key). Numbered pins in
 * visit order and a dashed route line; distances are the same approximations
 * Plan Doctor uses (see src/lib/geo.ts).
 */
import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RecordData } from 'deepspace'
import { hasCoords, totalKm } from '@/lib/geo'
import { sortDay } from '@/lib/planCheck'
import { CATEGORY_META, type Stop, type Trip } from './types'

export function RouteMap({ trip, stops, date, label }: { trip: Trip; stops: RecordData<Stop>[]; date: string; label: string }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const bounds = useRef<L.LatLngBounds | null>(null)

  const ordered = useMemo(
    () => sortDay(stops.filter((s) => s.data.date === date).map((s) => ({ ...s.data, id: s.recordId }))),
    [stops, date],
  )
  const located = useMemo(() => ordered.filter(hasCoords), [ordered])

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true })
    L.control.zoom({ position: 'bottomright' }).addTo(map.current)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'th-tiles',
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    const ro = new ResizeObserver(() => {
      map.current?.invalidateSize()
      if (bounds.current) map.current?.fitBounds(bounds.current, { padding: [60, 60], maxZoom: 15 })
    })
    ro.observe(el.current)
    return () => {
      ro.disconnect()
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
    located.forEach((s) => {
      const color = (CATEGORY_META[s.category ?? 'other'] ?? CATEGORY_META.other).color
      const n = ordered.indexOf(s) + 1
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:700 13px Inter,sans-serif;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25)">${n}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const ll: L.LatLngExpression = [s.lat as number, s.lng as number]
      pts.push(ll)
      // Leaflet renders string tooltips as HTML — pass a text node so a stop
      // title can never inject markup into other travelers' browsers.
      const tip = document.createElement('span')
      tip.textContent = `${s.start ?? ''} ${s.title}`.trim()
      L.marker(ll, { icon }).bindTooltip(tip, { direction: 'top', offset: [0, -14] }).addTo(g)
    })
    if (pts.length > 1) L.polyline(pts, { color: '#1c1814', weight: 3, opacity: 0.7, dashArray: '2 8', lineCap: 'round' }).addTo(g)
    bounds.current = pts.length ? L.latLngBounds(pts) : null
    m.invalidateSize()
    if (bounds.current) {
      const b = bounds.current
      m.fitBounds(b, { padding: [60, 60], maxZoom: 15 })
      // Layout can settle after first paint (flex panes); refit once it has.
      setTimeout(() => map.current && map.current.invalidateSize() && map.current.fitBounds(b, { padding: [60, 60], maxZoom: 15 }), 250)
    }
    else if (typeof trip.lat === 'number' && typeof trip.lng === 'number') m.setView([trip.lat, trip.lng], 12)
    else m.setView([20, 0], 2)
  }, [located, ordered, trip.lat, trip.lng])

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-3xl border border-border">
      <div ref={el} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-2xl bg-card/95 px-3.5 py-2 shadow-[var(--shadow-card-hover)] backdrop-blur">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {located.length} pinned · {totalKm(ordered)} km · approx route
        </p>
      </div>
      {ordered.length > located.length && (
        <p className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-full bg-card/95 px-3 py-1 text-[11px] text-warning shadow">
          {ordered.length - located.length} stop(s) not on the map yet
        </p>
      )}
    </div>
  )
}
