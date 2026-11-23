/**
 * Reviews block for the place sheet: a TripHivers / Google tab switch, review
 * cards with "Read more" for long text, and the add-your-review entry point.
 */
import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/components/ui'
import { PersonAvatar, usePeople } from '@/components/social'
import type { PlaceDetails } from '@/server/placeDetails'
import type { TripMoney } from '../useTripMoney'
import type { Community } from '../usePlaceInsights'
import { RateRow } from '../PlaceReviewForm'

const LONG_REVIEW_CHARS = 220
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-honey)] focus-visible:ring-offset-2 focus-visible:ring-offset-card'

type Tab = 'triphivers' | 'google'

export function Stars({ value, size = 'size-3' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn(size, s <= Math.round(value) ? 'fill-[var(--color-honey)] text-[var(--color-honey)]' : 'text-muted-foreground/30')} aria-hidden />
      ))}
    </span>
  )
}

function ReviewText({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const isLong = text.length > LONG_REVIEW_CHARS
  return (
    <div className="mt-1.5">
      <p className={cn('whitespace-pre-line text-[13px] leading-relaxed text-foreground/85', isLong && !isOpen && 'line-clamp-4')}>{text}</p>
      {isLong && (
        <button type="button" onClick={() => setIsOpen((v) => !v)} className={cn('mt-1 rounded text-xs font-semibold underline underline-offset-2 hover:text-foreground', focusRing)}>
          {isOpen ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-muted-foreground" aria-hidden>
      {name.trim().charAt(0) || 'G'}
    </span>
  )
}

function GoogleList({ details, isLoading }: { details: PlaceDetails | null; isLoading: boolean }) {
  if (isLoading) return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
  if (!details?.reviews.length) return <p className="py-6 text-center text-sm text-muted-foreground">Google has no written reviews for this place yet.</p>
  return (
    <ul className="divide-y divide-border" data-testid="google-reviews">
      {details.reviews.map((r, i) => (
        <li key={`${r.author}-${i}`} className="flex gap-3 py-3.5 first:pt-0">
          <Initial name={r.author} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.author}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.rating != null && <Stars value={r.rating} />}
              {r.when}
            </p>
            <ReviewText text={r.text} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TripHiverList({ community, money }: { community: Community; money: TripMoney }) {
  const { person } = usePeople()
  if (!community.reviews.length) return <p className="py-6 text-center text-sm text-muted-foreground">No TripHiver reviews yet. Be the first after you go.</p>
  return (
    <ul className="divide-y divide-border" data-testid="triphiver-reviews">
      {community.reviews.map((r) => (
        <li key={r.id} className="flex gap-3 py-3.5 first:pt-0">
          <PersonAvatar uid={r.userId} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{person(r.userId).name}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <Stars value={r.rating} />
              {typeof r.spentUsd === 'number' && <span>spent {money.local(r.spentUsd)} pp</span>}
            </p>
            {r.text && <ReviewText text={r.text} />}
          </div>
        </li>
      ))}
    </ul>
  )
}

interface PlaceReviewsProps {
  tripId: string
  name: string
  community: Community
  details: PlaceDetails | null
  isLoading: boolean
  money: TripMoney
}

export function PlaceReviews({ tripId, name, community, details, isLoading, money }: PlaceReviewsProps) {
  const [picked, setPicked] = useState<Tab | null>(null)
  const [isRating, setIsRating] = useState(false)
  const tab: Tab = picked ?? (community.count ? 'triphivers' : 'google')
  const googleCount = details?.reviews.length ?? 0
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'triphivers', label: 'TripHivers', count: community.count },
    { id: 'google', label: 'Google', count: googleCount },
  ]

  return (
    <section aria-label="Reviews" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Review source" className="inline-flex rounded-full bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setPicked(t.id)}
              className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', focusRing, tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
        {!isRating && (
          <button type="button" onClick={() => setIsRating(true)} className={cn('inline-flex items-center gap-1.5 rounded-full bg-honey-soft px-3.5 py-1.5 text-xs font-semibold transition hover:brightness-95', focusRing)}>
            <Star className="size-3.5" aria-hidden /> Rate this place
          </button>
        )}
      </div>
      {isRating && (
        <div className="-mx-3">
          <RateRow tripId={tripId} name={name} onDone={() => { setIsRating(false); setPicked('triphivers') }} />
        </div>
      )}
      <div role="tabpanel">
        {tab === 'google' ? <GoogleList details={details} isLoading={isLoading} /> : <TripHiverList community={community} money={money} />}
      </div>
      {tab === 'google' && googleCount > 0 && <p className="text-[11px] text-muted-foreground">Recent reviews from Google Maps.</p>}
    </section>
  )
}
