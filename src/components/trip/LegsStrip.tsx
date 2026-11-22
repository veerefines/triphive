/**
 * Horizontal strip of the day's legs, overlaid on the map: best way to get
 * from each stop to the next, why, and the alternatives with time + cost in
 * the destination currency (home currency on hover).
 */
import { useState } from 'react'
import { Navigation } from 'lucide-react'
import { cn } from '@/components/ui'
import { googleDirectionsUrl } from '@/lib/geo'
import type { LegMode } from '@/lib/legs'
import type { DayLeg, DayStopPoint } from './useDayRoutes'
import type { TripMoney } from './useTripMoney'

export const MODE_STYLE: Record<LegMode, { color: string; emoji: string; label: string; dash?: string; maps: 'walk' | 'transit' | 'drive' }> = {
  walk: { color: '#16a34a', emoji: '🚶', label: 'Walk', dash: '1 9', maps: 'walk' },
  transit: { color: '#2563eb', emoji: '🚇', label: 'Transit', maps: 'transit' },
  taxi: { color: '#ea580c', emoji: '🚕', label: 'Taxi', maps: 'drive' },
}

interface LegsStripProps {
  legs: DayLeg[]
  points: DayStopPoint[]
  money: TripMoney
  activeStopId?: string | null
  onFocus?: (stopId: string) => void
}

export function LegsStrip({ legs, points, money, activeStopId, onFocus }: LegsStripProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const indexOf = (id: string) => points.findIndex((p) => p.id === id) + 1
  const price = (usd: number) => (usd > 0 ? money.local(usd) : 'free')

  return (
    <div className="absolute inset-x-3 bottom-3 z-[500] flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Best routes between stops">
      {legs.map((leg) => {
        const style = MODE_STYLE[leg.best.mode]
        const key = `${leg.fromId}>${leg.toId}`
        const isOpen = openId === key
        const isHot = leg.toId === activeStopId || leg.fromId === activeStopId
        const from = points.find((p) => p.id === leg.fromId)
        const to = points.find((p) => p.id === leg.toId)
        const url = from && to ? googleDirectionsUrl([from, to], style.maps) : null
        const home = leg.best.usd > 0 ? money.homeLabel(leg.best.usd) : null
        return (
          <article
            key={key}
            className={cn(
              'w-60 shrink-0 snap-start rounded-2xl border bg-card/95 p-3 text-left shadow-[var(--shadow-card-hover)] backdrop-blur transition',
              isHot ? 'border-foreground' : 'border-border',
            )}
          >
            <button
              type="button"
              className="block w-full text-left"
              aria-expanded={isOpen}
              onClick={() => {
                setOpenId(isOpen ? null : key)
                onFocus?.(leg.toId)
              }}
            >
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: style.color }} />
                Stop {indexOf(leg.fromId)} → {indexOf(leg.toId)}
                {!leg.isRouted && <span className="normal-case tracking-normal">· est.</span>}
              </p>
              <p className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {style.emoji} {style.label} · {leg.best.minutes} min
                </span>
                <span className="font-mono text-xs" title={home ? `≈ ${home} per person` : 'per person'}>
                  {price(leg.best.usd)}
                </span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{leg.why}</p>
            </button>
            {isOpen && (
              <div className="anim-in mt-2 space-y-1 border-t border-border pt-2">
                {leg.options.map((o) => (
                  <p key={o.mode} className={cn('flex justify-between text-[11px]', o.mode === leg.best.mode ? 'font-semibold' : 'text-muted-foreground')}>
                    <span>
                      {MODE_STYLE[o.mode].emoji} {MODE_STYLE[o.mode].label} · {o.km.toFixed(1)} km
                    </span>
                    <span className="font-mono">
                      {o.minutes} min · {price(o.usd)}
                    </span>
                  </p>
                ))}
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-honey hover:underline">
                    <Navigation className="size-3" /> Directions
                  </a>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
