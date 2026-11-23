/**
 * Place cards rendered inside Hive's chat for the `show_places` tool, each
 * with a one-click "Add to day". Adding is the user's own action (addStop
 * action, membership-checked) — no vote needed, unlike Hive's proposals.
 */
import { createContext, useContext, useState } from 'react'
import { Check, ExternalLink, MapPin, Navigation, Plus, Star } from 'lucide-react'
import { cn, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'
import { safeHref } from '@/lib/safeUrl'
import { CATEGORY_META } from './types'

export type SuggestedPlace = {
  name: string
  why?: string
  category?: string
  date?: string
  start?: string
  end?: string
  costPerPerson?: number
  outdoor?: boolean
  sourceUrl?: string
  lat?: number
  lng?: number
  address?: string
  rating?: number
  ratingCount?: number
  mapsUrl?: string
  openNow?: boolean
}

export type TripChatContextValue = { tripId: string; dates: string[]; labelFor: (date: string) => string }
export const TripChatContext = createContext<TripChatContextValue | null>(null)

export function mapsSearchUrl(p: { name: string; lat?: number; lng?: number }) {
  const q = typeof p.lat === 'number' ? `${p.lat},${p.lng}` : p.name
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function PlaceCards({ places }: { places: SuggestedPlace[] }) {
  const ctx = useContext(TripChatContext)
  if (!ctx || !places.length) return null
  return (
    <div className="flex flex-col gap-2">
      {places.map((p, i) => (
        <PlaceCard key={`${p.name}-${i}`} place={p} ctx={ctx} />
      ))}
    </div>
  )
}

function PlaceCard({ place: p, ctx }: { place: SuggestedPlace; ctx: TripChatContextValue }) {
  const toast = useToast()
  const meta = CATEGORY_META[p.category ?? 'other'] ?? CATEGORY_META.other
  const [date, setDate] = useState(p.date && ctx.dates.includes(p.date) ? p.date : ctx.dates[0])
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle')

  async function add() {
    setState('adding')
    try {
      await callAction('addStop', {
        tripId: ctx.tripId,
        fromHive: true,
        stop: {
          title: p.name,
          date,
          start: p.start,
          end: p.end,
          category: p.category ?? 'other',
          notes: p.why,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          url: safeHref(p.mapsUrl) ?? safeHref(p.sourceUrl),
          costPerPerson: p.costPerPerson,
          outdoor: !!p.outdoor,
          rating: p.rating,
          ratingCount: p.ratingCount,
        },
      })
      setState('added')
      toast.success(`Added to ${ctx.labelFor(date)}`, p.name)
      // Re-run the plan check for the new stop.
      callAction('runPlanCheck', { tripId: ctx.tripId }).catch(() => undefined)
    } catch (err) {
      setState('idle')
      toast.error('Could not add', (err as Error).message)
    }
  }

  return (
    <div data-testid="place-card" className="rounded-2xl border border-border bg-card p-3">
      <div className="flex gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${meta.color}18` }}>
          {meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{p.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
            {typeof p.rating === 'number' && (
              <span className="flex items-center gap-0.5 text-foreground">
                <Star className="size-3 fill-[var(--color-honey)] text-honey" />
                {p.rating.toFixed(1)}
                {p.ratingCount ? <span className="text-muted-foreground">({p.ratingCount.toLocaleString()})</span> : null}
              </span>
            )}
            <span>{meta.label}</span>
            {typeof p.costPerPerson === 'number' && <span>· ≈${p.costPerPerson}</span>}
            {p.openNow === true && <span className="text-success">· open now</span>}
          </p>
          {p.why && <p className="mt-1 text-xs leading-snug text-foreground/80">{p.why}</p>}
          {p.address && (
            <p className="mt-1 flex items-center gap-1 truncate font-mono text-[10.5px] text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{p.address.split(',').slice(0, 3).join(',')}</span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <select
          aria-label={`Day for ${p.name}`}
          value={date}
          disabled={state !== 'idle'}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-full border border-border bg-background px-2.5 font-mono text-[11px]"
        >
          {ctx.dates.map((d) => (
            <option key={d} value={d}>
              {ctx.labelFor(d)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={state !== 'idle'}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition',
            state === 'added' ? 'bg-success/15 text-success' : 'bg-foreground text-background hover:opacity-90 disabled:opacity-60',
          )}
        >
          {state === 'added' ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
          {state === 'added' ? 'Added' : state === 'adding' ? 'Adding…' : 'Add'}
        </button>
        <a
          href={safeHref(p.mapsUrl) ?? mapsSearchUrl(p)}
          target="_blank"
          rel="noreferrer"
          aria-label={`${p.name} on Google Maps`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border hover:bg-muted"
        >
          <Navigation className="size-3.5" />
        </a>
        {safeHref(p.sourceUrl) && (
          <a
            href={safeHref(p.sourceUrl)}
            target="_blank"
            rel="noreferrer"
            aria-label="Source"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border hover:bg-muted"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
