/**
 * Map pin hover card: photos, time, cost, Google rating, TripHiver reviews and
 * what Hive suggested for this place in the group chat. Everything comes from
 * data already loaded or cached (stops, place_reviews, trip_messages cards,
 * place_photos), so hovering costs no LLM or Places call beyond the photo cache.
 */
import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import { ExternalLink, Navigation, Star } from 'lucide-react'
import { PlaceGallery } from '@/components/ui/PlaceImage'
import { HiveAvatar } from '@/components/ui/Brand'
import { cn } from '@/components/ui'
import type { PlaceCard } from '@/ai/hive-group'
import { placeKey, summarizeReviews, type PlaceReviewData } from '@/lib/reviews'
import { CATEGORY_META, type Stop } from './types'
import type { TripMoney } from './useTripMoney'
import { PEEK_HEIGHT, PEEK_WIDTH, type PeekPlacement } from './peekPlacement'

const MAX_QUOTES = 2
const MAX_CHIPS = 4

export type PeekStop = Stop & { id: string }
type TripMsg = { tripId: string; cards?: PlaceCard[] }

type MapPlacePeekProps = {
  stop: PeekStop
  destination: string
  money: TripMoney
  placement: PeekPlacement
  onEnter: () => void
  onLeave: () => void
}

/** The Hive card shared for this place most recently, if any. */
function useHiveCard(tripId: string, name: string): PlaceCard | undefined {
  const { records } = useQuery<TripMsg>('trip_messages', { where: { tripId } })
  return useMemo(() => {
    const key = placeKey(name, '')
    const cards = records.flatMap((m) => m.data.cards ?? [])
    return cards.slice().reverse().find((c) => placeKey(c.name, '') === key)
  }, [records, name])
}

function useCommunity(name: string, destination: string) {
  const { records } = useQuery<PlaceReviewData>('place_reviews', { where: { placeKey: placeKey(name, destination) } })
  return useMemo(() => {
    const rows = records.map((r) => r.data)
    const quotes = rows.map((r) => r.text?.trim()).filter((t): t is string => !!t).slice(0, MAX_QUOTES)
    return { ...summarizeReviews(rows), quotes }
  }, [records])
}

function Chips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, MAX_CHIPS).map((t) => (
          <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function mapsLinks(stop: PeekStop, destination: string) {
  const hasPoint = typeof stop.lat === 'number' && typeof stop.lng === 'number'
  const where = hasPoint ? `${stop.lat},${stop.lng}` : `${stop.title}, ${destination}`
  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`,
    open: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.title}, ${destination}`)}`,
  }
}

export function MapPlacePeek({ stop, destination, money, placement, onEnter, onLeave }: MapPlacePeekProps) {
  const meta = CATEGORY_META[stop.category ?? 'other'] ?? CATEGORY_META.other
  const card = useHiveCard(stop.tripId, stop.title)
  const community = useCommunity(stop.title, destination)
  const rating = stop.rating ?? card?.rating
  const ratingCount = stop.ratingCount ?? card?.ratingCount
  const cost = stop.costPerPerson ?? card?.costPerPersonUsd ?? community.avgSpentUsd ?? undefined
  const time = [stop.start, stop.end].filter(Boolean).join('–')
  const links = mapsLinks(stop, destination)
  const query = { q: stop.title, near: destination, lat: stop.lat, lng: stop.lng }

  return (
    <div
      data-testid="map-peek"
      role="dialog"
      aria-label={`${stop.title} details`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ left: placement.left, top: placement.top, width: PEEK_WIDTH, maxHeight: PEEK_HEIGHT }}
      className={cn(
        'absolute z-[600] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card-hover)]',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        placement.isBelow ? 'origin-top' : 'origin-bottom',
      )}
    >
      <div className="relative shrink-0">
        <PlaceGallery query={query} alt={stop.title} emoji={meta.emoji} color={meta.color} className="aspect-[16/9] w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
        <div className="pointer-events-none absolute inset-x-3 bottom-2 text-white">
          <p className="truncate font-display text-base font-semibold leading-tight">{stop.title}</p>
          <p className="text-[11px] opacity-90">
            {meta.emoji} {meta.label}
            {time && ` · ${time}`}
            {typeof cost === 'number' && ` · ${cost > 0 ? `${money.local(cost)} pp` : 'free'}`}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {typeof rating === 'number' && (
            <span className="inline-flex items-center gap-1 font-medium">
              <Star className="size-3.5 fill-[var(--color-honey)] text-[var(--color-honey)]" aria-hidden />
              {rating.toFixed(1)}
              {ratingCount ? <span className="font-normal text-muted-foreground">({ratingCount.toLocaleString()}) Google</span> : null}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5" data-testid="map-peek-community">
            <HiveAvatar size={18} />
            {community.count ? (
              <>
                <b>{community.avgRating?.toFixed(1)}</b>
                <span className="text-muted-foreground">
                  from {community.count} TripHiver{community.count === 1 ? '' : 's'}
                  {community.avgSpentUsd != null && ` · spent ~${money.local(community.avgSpentUsd)}`}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No TripHiver reviews yet</span>
            )}
          </span>
        </div>

        {community.quotes.map((q) => (
          <p key={q} className="border-l-2 border-[var(--color-honey)] pl-2 italic text-muted-foreground">
            “{q}”
          </p>
        ))}

        {card?.why && <p className="text-foreground/90">{card.why}</p>}
        {!card && stop.notes && <p className="text-foreground/90">{stop.notes}</p>}
        <Chips label="Must try" items={card?.mustTry ?? []} />
        <Chips label="Do nearby" items={[...(card?.thingsToDo ?? []), ...(card?.nearbyFood ?? [])]} />
        {stop.address && <p className="truncate text-muted-foreground">{stop.address}</p>}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border p-2">
        <a href={links.directions} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90">
          <Navigation className="size-3.5" aria-hidden /> Directions
        </a>
        <a href={links.open} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
          <ExternalLink className="size-3.5" aria-hidden /> Open in Maps
        </a>
      </div>
    </div>
  )
}
