/**
 * Place card Hive posts into the group chat: Google/OSM rating, TripHive
 * Featured perk, what other TripHivers said, must-try dishes, nearby food,
 * things to do, cost in the destination currency, and one-tap Add / Rate.
 */
import { useState } from 'react'
import { BadgeCheck, MapPin, Star } from 'lucide-react'
import { Button, cn, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'
import { safeHref } from '@/lib/safeUrl'
import type { PlaceCard } from '@/ai/hive-group'
import { CATEGORY_META } from './types'
import type { TripMoney } from './useTripMoney'

interface HiveCardProps {
  card: PlaceCard
  tripId: string
  dates: string[]
  labelFor: (date: string) => string
  money: TripMoney
}

const STARS = [1, 2, 3, 4, 5]

function Chips({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="mt-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((it) => (
          <span key={it} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{it}</span>
        ))}
      </div>
    </div>
  )
}

function RateRow({ tripId, name, onDone }: { tripId: string; name: string; onDone: () => void }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [spent, setSpent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function save() {
    setIsSaving(true)
    try {
      await callAction('reviewPlace', { tripId, name, rating, text, spentUsd: spent ? Number(spent) : undefined })
      toast.success('Thanks, TripHiver!', `Your review of ${name} helps the next group.`)
      onDone()
    } catch (err) {
      toast.error('Review not saved', (err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="anim-in mt-2 space-y-2 rounded-xl border border-border p-2">
      <div className="flex gap-1" role="radiogroup" aria-label={`Rate ${name}`}>
        {STARS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} stars`} onClick={() => setRating(s)}>
            <Star className={cn('size-5', s <= rating ? 'fill-[var(--color-honey)] text-honey' : 'text-muted-foreground')} />
          </button>
        ))}
      </div>
      <input value={text} maxLength={600} onChange={(e) => setText(e.target.value)} placeholder="What should the next group know?" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none" />
      <div className="flex items-center gap-2">
        <input value={spent} inputMode="decimal" onChange={(e) => setSpent(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Spent pp (USD)" aria-label="Spent per person in USD" className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-xs outline-none" />
        <Button size="sm" disabled={!rating} loading={isSaving} onClick={save}>Save review</Button>
      </div>
    </div>
  )
}

export function HiveCard({ card: c, tripId, dates, labelFor, money }: HiveCardProps) {
  const toast = useToast()
  const meta = CATEGORY_META[c.category ?? 'other'] ?? CATEGORY_META.other
  const [date, setDate] = useState(c.date && dates.includes(c.date) ? c.date : dates[0])
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle')
  const [isRating, setIsRating] = useState(false)
  const cost = c.costPerPersonUsd ?? c.community.avgSpentUsd ?? undefined
  const home = typeof cost === 'number' && cost > 0 ? money.homeLabel(cost) : null

  async function add() {
    setState('adding')
    try {
      await callAction('addStop', {
        tripId,
        fromHive: true,
        stop: { title: c.name, date, category: c.category, notes: c.why, address: c.address, lat: c.lat, lng: c.lng, url: safeHref(c.mapsUrl), costPerPerson: cost, rating: c.rating, ratingCount: c.ratingCount },
      })
      setState('added')
      toast.success(`Added to ${labelFor(date)}`, c.name)
      callAction('runPlanCheck', { tripId }).catch(() => undefined)
    } catch (err) {
      setState('idle')
      toast.error('Could not add', (err as Error).message)
    }
  }

  return (
    <article data-testid="hive-card" className="mt-2 w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
      <header className="flex gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${meta.color}18` }}>{meta.emoji}</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{c.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
            {typeof c.rating === 'number' && (
              <span className="flex items-center gap-0.5 text-foreground"><Star className="size-3 fill-[var(--color-honey)] text-honey" />{c.rating.toFixed(1)}</span>
            )}
            <span>{meta.label}</span>
            {typeof cost === 'number' && <span title={home ? `≈ ${home}` : undefined}>· {cost > 0 ? `${money.local(cost)} pp` : 'free'}</span>}
          </p>
        </div>
      </header>
      {c.featuredPerk && (
        <p className="mt-2 flex items-center gap-1 rounded-lg bg-honey/15 px-2 py-1 text-[11px] font-medium">
          <BadgeCheck className="size-3.5 text-honey" /> TripHive Verified · {c.featuredPerk}
        </p>
      )}
      {c.why && <p className="mt-2 text-xs leading-snug text-foreground/80">{c.why}</p>}
      {c.community.count > 0 ? (
        <div className="mt-2 rounded-lg bg-muted/60 px-2 py-1.5 text-[11px]">
          <p className="font-medium">🐝 {c.community.count} TripHiver{c.community.count > 1 ? 's' : ''} · ★ {c.community.avgRating}{c.community.avgSpentUsd ? ` · spent ≈${money.local(c.community.avgSpentUsd)}` : ''}</p>
          {c.community.quotes.map((q) => <p key={q} className="mt-0.5 italic text-muted-foreground">“{q}”</p>)}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">No TripHiver reviews yet. Be the first after you go.</p>
      )}
      <Chips title="Must try" items={c.mustTry} />
      <Chips title="Eat nearby" items={c.nearbyFood} />
      <Chips title="Do nearby" items={c.thingsToDo} />
      {c.tips.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-muted-foreground">{c.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      )}
      {c.address && (
        <p className="mt-2 flex items-center gap-1 truncate font-mono text-[10.5px] text-muted-foreground"><MapPin className="size-3 shrink-0" /><span className="truncate">{c.address.split(',').slice(0, 3).join(',')}</span></p>
      )}
      <footer className="mt-2.5 flex flex-wrap items-center gap-2">
        {dates.length > 1 && (
          <select aria-label="Day" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
            {dates.map((d) => <option key={d} value={d}>{labelFor(d)}</option>)}
          </select>
        )}
        <Button size="sm" onClick={add} loading={state === 'adding'} disabled={state === 'added' || !date}>{state === 'added' ? 'Added ✓' : 'Add to plan'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setIsRating((v) => !v)}>Rate</Button>
      </footer>
      {isRating && <RateRow tripId={tripId} name={c.name} onDone={() => setIsRating(false)} />}
    </article>
  )
}
