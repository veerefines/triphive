/**
 * Day route map — Leaflet + OpenStreetMap tiles (no API key). Numbered pins in
 * visit order, each hop drawn on real streets (OSRM) and coloured by the best
 * way to get there, plus a strip of legs with walk / transit / taxi options
 * priced in the destination currency (see useDayRoutes + src/lib/legs.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RecordData } from 'deepspace'
import { googleDirectionsUrl, hasCoords } from '@/lib/geo'
import { sortDay } from '@/lib/planCheck'
import { CATEGORY_META, type Stop, type Trip } from './types'
import { useDayRoutes, type DayStopPoint } from './useDayRoutes'
import type { TripMoney } from './useTripMoney'
import { LegsStrip, MODE_STYLE } from './LegsStrip'
import { MapPlacePeek, type PeekStop } from './MapPlacePeek'
import { placePeek, type PeekPlacement } from './peekPlacement'

/** Hover intent before the peek opens, and grace period to move onto it. */
const PEEK_OPEN_MS = 150
const PEEK_CLOSE_MS = 220

type PeekState = { id: string; placement: PeekPlacement }

export function RouteMap({
  trip,
  stops,
  date,
  label,
  activeStopId,
  onPinClick,
  onPinHover,
  money,
}: {
  money: TripMoney
  trip: Trip
  stops: RecordData<Stop>[]
  date: string
  label: string
  activeStopId?: string | null
  onPinClick?: (id: string) => void
  onPinHover?: (id: string | null) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const bounds = useRef<L.LatLngBounds | null>(null)
  const [peek, setPeek] = useState<PeekState | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), [])
  const scheduleClose = useCallback(() => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setPeek(null), PEEK_CLOSE_MS)
  }, [])
  const scheduleOpen = useCallback((id: string, ll: L.LatLngExpression) => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => {
      const m = map.current
      const box = el.current
      if (!m || !box) return
      const pin = m.latLngToContainerPoint(ll)
      setPeek({ id, placement: placePeek(pin, { width: box.clientWidth, height: box.clientHeight }) })
    }, PEEK_OPEN_MS)
  }, [])
  useEffect(() => () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  const ordered = useMemo(
    () => sortDay(stops.filter((s) => s.data.date === date).map((s) => ({ ...s.data, id: s.recordId }))),
    [stops, date],
  )
  const located = useMemo(() => ordered.filter(hasCoords), [ordered])
  const points = useMemo<DayStopPoint[]>(
    () => located.map((s) => ({ id: s.id, title: s.title, lat: s.lat as number, lng: s.lng as number, start: s.start })),
    [located],
  )
  const peekStop: PeekStop | undefined = located.find((s) => s.id === peek?.id)
  const rainy = !!trip.forecast?.[date]?.rain
  const legs = useDayRoutes(points, money, rainy)
  const totals = useMemo(
    () => legs.reduce((t, l) => ({ km: t.km + l.best.km, min: t.min + l.best.minutes, usd: t.usd + l.best.usd }), { km: 0, min: 0, usd: 0 }),
    [legs],
  )

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
    // The peek is anchored to a pixel; any pan or zoom would leave it behind.
    map.current.on('movestart zoomstart', () => setPeek(null))
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
      const isActive = s.id === activeStopId
      const icon = L.divIcon({
        className: isActive ? 'th-pin-active' : '',
        html: `<div style="transition:transform .15s;${isActive ? 'transform:scale(1.3);' : ''}background:${color};color:#fff;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:700 13px Inter,sans-serif;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25)">${n}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const ll: L.LatLngExpression = [s.lat as number, s.lng as number]
      pts.push(ll)
      // Details render in the React peek (text only, no HTML), not a Leaflet tooltip.
      const marker = L.marker(ll, { icon, zIndexOffset: isActive ? 1000 : 0, title: s.title })
      marker.on('click', () => {
        onPinClick?.(s.id)
        scheduleOpen(s.id, ll) // touch has no hover: a tap opens the peek
      })
      marker.on('mouseover', () => {
        onPinHover?.(s.id)
        scheduleOpen(s.id, ll)
      })
      marker.on('mouseout', () => {
        onPinHover?.(null)
        scheduleClose()
      })
      marker.addTo(g)
    })
    legs.forEach((leg) => {
      const style = MODE_STYLE[leg.best.mode]
      const hot = leg.toId === activeStopId || leg.fromId === activeStopId
      L.polyline(leg.path, { color: '#fff', weight: hot ? 9 : 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(g)
      L.polyline(leg.path, {
        color: style.color,
        weight: hot ? 5 : 4,
        opacity: leg.isRouted ? 0.95 : 0.6,
        dashArray: style.dash ?? (leg.isRouted ? undefined : '2 8'),
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(g)
    })
    const nextBounds = pts.length ? L.latLngBounds(pts) : null
    const sameBounds = !!nextBounds && !!bounds.current && nextBounds.equals(bounds.current)
    bounds.current = nextBounds
    if (sameBounds) return
    m.invalidateSize()
    if (bounds.current) {
      const b = bounds.current
      m.fitBounds(b, { padding: [60, 60], maxZoom: 15 })
      // Layout can settle after first paint (flex panes); refit once it has.
      setTimeout(() => map.current && map.current.invalidateSize() && map.current.fitBounds(b, { padding: [60, 60], maxZoom: 15 }), 250)
    }
    else if (typeof trip.lat === 'number' && typeof trip.lng === 'number') m.setView([trip.lat, trip.lng], 12)
    else m.setView([20, 0], 2)
  }, [located, ordered, legs, trip.lat, trip.lng, activeStopId, onPinClick, onPinHover, scheduleOpen, scheduleClose])

  return (
    <div className="relative isolate z-0 h-full min-h-[360px] overflow-hidden rounded-3xl border border-border">
      <div ref={el} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[55%] rounded-2xl bg-card/95 px-3.5 py-2 shadow-[var(--shadow-card-hover)] backdrop-blur">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {located.length} pinned
          {legs.length > 0 && (
            <>
              {' '}· {totals.km.toFixed(1)} km · {totals.min} min moving · {totals.usd > 0 ? `${money.local(totals.usd)} pp` : 'free'}
            </>
          )}
        </p>
      </div>
      {located.length > 1 && (
        <a
          href={googleDirectionsUrl(points, legs.some((l) => l.best.mode !== 'walk') ? 'transit' : 'walk') ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background shadow-lg hover:opacity-90"
        >
          <span className="hidden sm:inline">Open day in&nbsp;</span>Google Maps ↗
        </a>
      )}
      {peekStop && peek && (
        <MapPlacePeek stop={peekStop} destination={trip.destination} money={money} placement={peek.placement} onEnter={cancelClose} onLeave={scheduleClose} />
      )}
      {legs.length > 0 && <LegsStrip legs={legs} points={points} money={money} activeStopId={activeStopId} onFocus={onPinClick} />}
      {ordered.length > located.length && (
        <p className="pointer-events-none absolute left-3 top-[4.5rem] z-[500] rounded-full bg-card/95 px-3 py-1 text-[11px] text-warning shadow">
          {ordered.length - located.length} stop(s) not on the map yet
        </p>
      )}
    </div>
  )
}
