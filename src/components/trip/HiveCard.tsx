/**
 * Place card Hive posts into the group chat: swipeable photo hero, Google
 * rating, TripHive Featured perk, what other TripHivers said, image rails for
 * must-try dishes / food nearby / things to do (each nearby tile one-tap
 * addable), cost in the destination currency, and one-tap Add / Rate.
 */
import { useState } from 'react'
import { BadgeCheck, Check, ChevronDown, MapPin, Plus, Star } from 'lucide-react'
import { Button, cn, useToast } from '@/components/ui'
import { RateRow } from './PlaceReviewForm'
import { PlaceGallery, PlaceImage } from '@/components/ui/PlaceImage'
import { HiveAvatar } from '@/components/ui/Brand'
import { callAction } from '@/lib/api'
import { safeHref } from '@/lib/safeUrl'
import type { PlaceCard } from '@/ai/hive-group'
import { CATEGORY_META } from './types'
import type { TripMoney } from './useTripMoney'

interface HiveCardProps {
  card: PlaceCard
  tripId: string
  destination: string
  dates: string[]
  labelFor: (date: string) => string
  money: TripMoney
}

type AddState = 'idle' | 'adding' | 'added'

function useAddStop(tripId: string, labelFor: (d: string) => string) {
  const toast = useToast()
  return async (date: string, stop: Record<string, unknown>, setState: (s: AddState) => void) => {
    setState('adding')
    try {
      await callAction('addStop', { tripId, fromHive: true, stop: { ...stop, date } })
      setState('added')
      toast.success(`Added to ${labelFor(date)}`, String(stop.title))
      callAction('runPlanCheck', { tripId }).catch(() => undefined)
    } catch (err) {
      setState('idle')
      toast.error('Could not add', (err as Error).message)
    }
  }
}

type RailProps = {
  title: string
  items: string[]
  destination: string
  emoji: string
  color: string
  onAdd?: (name: string, setState: (s: AddState) => void) => void
}

function Tile({ name, destination, emoji, color, onAdd }: Omit<RailProps, 'title' | 'items'> & { name: string }) {
  const [state, setState] = useState<AddState>('idle')
  return (
    <li className="group w-[104px] shrink-0 snap-start">
      <div className="relative">
        <PlaceImage query={{ q: name, near: destination }} alt={name} emoji={emoji} color={color} className="aspect-[4/3] w-full rounded-xl" imgClassName="group-hover:scale-105" />
        {onAdd && (
          <button
            type="button"
            aria-label={state === 'added' ? `${name} added` : `Add ${name} to plan`}
            disabled={state !== 'idle'}
            onClick={() => onAdd(name, setState)}
            className={cn(
              'absolute right-1 top-1 flex size-6 items-center justify-center rounded-full shadow transition active:scale-90',
              state === 'added' ? 'bg-emerald-600 text-white' : 'bg-white/95 text-foreground hover:bg-primary hover:text-primary-foreground',
            )}
          >
            {state === 'added' ? <Check className="size-3.5" /> : <Plus className={cn('size-3.5', state === 'adding' && 'animate-spin')} />}
          </button>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-tight">{name}</p>
    </li>
  )
}

function Rail({ title, items, ...tile }: RailProps) {
  if (!items.length) return null
  return (
    <section className="mt-3">
      <p className="px-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1.5 flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => <Tile key={it} name={it} {...tile} />)}
      </ul>
    </section>
  )
}

function Community({ c, money }: { c: PlaceCard['community']; money: TripMoney }) {
  if (c.count === 0) return <p className="mx-3 mt-2 text-[11px] text-muted-foreground">No TripHiver reviews yet. Be the first after you go.</p>
  return (
    <div className="mx-3 mt-2 rounded-xl bg-honey/10 px-2.5 py-2 text-[11px]">
      <p className="flex items-center gap-1.5 font-medium">
        <HiveAvatar size={18} />
        {c.count} TripHiver{c.count > 1 ? 's' : ''} · <Star className="size-3 fill-[var(--color-honey)] text-honey" /> {c.avgRating}
        {c.avgSpentUsd ? ` · spent ≈${money.local(c.avgSpentUsd)}` : ''}
      </p>
      {c.quotes.map((q) => <p key={q} className="mt-1 italic text-muted-foreground">“{q}”</p>)}
    </div>
  )
}

export function HiveCard({ card: c, tripId, destination, dates, labelFor, money }: HiveCardProps) {
  const meta = CATEGORY_META[c.category ?? 'other'] ?? CATEGORY_META.other
  const [date, setDate] = useState(c.date && dates.includes(c.date) ? c.date : dates[0])
  const [state, setState] = useState<AddState>('idle')
  const [isRating, setIsRating] = useState(false)
  const [isTipsOpen, setIsTipsOpen] = useState(false)
  const addStop = useAddStop(tripId, labelFor)
  const cost = c.costPerPersonUsd ?? c.community.avgSpentUsd ?? undefined
  const home = typeof cost === 'number' && cost > 0 ? money.homeLabel(cost) : null
  const near = { lat: c.lat, lng: c.lng }

  const addMain = () =>
    addStop(date, { title: c.name, category: c.category, notes: c.why, address: c.address, lat: c.lat, lng: c.lng, url: safeHref(c.mapsUrl), costPerPerson: cost, rating: c.rating, ratingCount: c.ratingCount }, setState)
  const addNearby = (category: string) => (name: string, set: (s: AddState) => void) =>
    addStop(date, { title: name, category, notes: `Near ${c.name} (Hive)` }, set)

  return (
    <article data-testid="hive-card" className="mt-2 w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg">
      <div className="relative">
        <PlaceGallery query={{ q: c.name, near: destination, ...near }} alt={c.name} emoji={meta.emoji} color={meta.color} className="aspect-[16/10] w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-6 pt-10 text-white">
          <p className="font-display text-lg font-semibold leading-tight drop-shadow">{c.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-white/85">
            {typeof c.rating === 'number' && (
              <span className="flex items-center gap-0.5 text-white"><Star className="size-3 fill-[var(--color-honey)] text-honey" />{c.rating.toFixed(1)}{c.ratingCount ? ` (${c.ratingCount.toLocaleString()})` : ''}</span>
            )}
            <span>{meta.emoji} {meta.label}</span>
            {typeof cost === 'number' && <span title={home ? `≈ ${home}` : undefined}>· {cost > 0 ? `${money.local(cost)} pp` : 'free'}</span>}
          </p>
        </div>
        {c.featuredPerk && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10.5px] font-semibold text-[#7a3412] shadow">
            <BadgeCheck className="size-3.5 text-honey" /> TripHive Verified
          </span>
        )}
      </div>

      {c.featuredPerk && <p className="mx-3 mt-2 rounded-lg bg-honey/15 px-2 py-1 text-[11px] font-medium">Perk · {c.featuredPerk}</p>}
      {c.why && <p className="mx-3 mt-2 text-xs leading-snug text-foreground/80">{c.why}</p>}
      <Community c={c.community} money={money} />

      <Rail title="Must try" items={c.mustTry} destination={destination} emoji="😋" color="#ea580c" />
      <Rail title="Eat nearby · tap + to add" items={c.nearbyFood} destination={destination} emoji={CATEGORY_META.food.emoji} color={CATEGORY_META.food.color} onAdd={addNearby('food')} />
      <Rail title="Do nearby · tap + to add" items={c.thingsToDo} destination={destination} emoji={CATEGORY_META.activity.emoji} color={CATEGORY_META.activity.color} onAdd={addNearby('activity')} />

      {c.tips.length > 0 && (
        <div className="mx-3 mt-2">
          <button type="button" aria-expanded={isTipsOpen} onClick={() => setIsTipsOpen((v) => !v)} className="flex w-full items-center justify-between py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Good to know ({c.tips.length})
            <ChevronDown className={cn('size-3.5 transition-transform', isTipsOpen && 'rotate-180')} />
          </button>
          {isTipsOpen && <ul className="anim-in list-disc pl-4 text-[11px] text-muted-foreground">{c.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
      )}
      {c.address && (
        <p className="mx-3 mt-2 flex items-center gap-1 truncate font-mono text-[10.5px] text-muted-foreground"><MapPin className="size-3 shrink-0" /><span className="truncate">{c.address.split(',').slice(0, 3).join(',')}</span></p>
      )}

      <footer className="sticky bottom-0 mt-2.5 flex flex-wrap items-center gap-2 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur">
        {dates.length > 1 && (
          <select aria-label="Day" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
            {dates.map((d) => <option key={d} value={d}>{labelFor(d)}</option>)}
          </select>
        )}
        <Button size="sm" onClick={addMain} loading={state === 'adding'} disabled={state === 'added' || !date}>{state === 'added' ? 'Added ✓' : 'Add to plan'}</Button>
        <Button size="sm" variant="ghost" aria-expanded={isRating} onClick={() => setIsRating((v) => !v)}><Star className="size-3.5" /> Rate</Button>
      </footer>
      {isRating && <div className="pb-3"><RateRow tripId={tripId} name={c.name} onDone={() => setIsRating(false)} /></div>}
    </article>
  )
}
