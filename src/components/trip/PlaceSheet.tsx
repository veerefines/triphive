/**
 * Expanded place view opened from the map peek: photo mosaic, Google rating,
 * summary, opening hours, Google reviews, every TripHiver review (with the
 * option to add yours), Hive's recommendations, cost and links.
 */
import { useState } from 'react'
import { Clock, ExternalLink, Globe, MapPin, Navigation, Phone, Star } from 'lucide-react'
import { Modal, cn } from '@/components/ui'
import { Photo } from '@/components/ui/PlaceImage'
import { HiveAvatar } from '@/components/ui/Brand'
import { PersonAvatar, usePeople } from '@/components/social'
import { usePlacePhotos } from '@/lib/usePlacePhotos'
import { usePlaceDetails } from '@/lib/usePlaceDetails'
import type { PlaceDetails } from '@/server/placeDetails'
import { CATEGORY_META } from './types'
import type { TripMoney } from './useTripMoney'
import type { PeekStop } from './MapPlacePeek'
import { RateRow } from './PlaceReviewForm'
import { useCommunity, useHiveCard, type Community } from './usePlaceInsights'
import { mapsLinks } from './placeLinks'

type PlaceSheetProps = {
  stop: PeekStop
  destination: string
  money: TripMoney
  onClose: () => void
}

const SHEET_PHOTOS = 4

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2', className)}>
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn('size-3', s <= Math.round(value) ? 'fill-[var(--color-honey)] text-[var(--color-honey)]' : 'text-muted-foreground/40')} aria-hidden />
      ))}
    </span>
  )
}

function Mosaic({ urls, isLoading, alt, emoji, color }: { urls: string[]; isLoading: boolean; alt: string; emoji: string; color: string }) {
  const [active, setActive] = useState(0)
  const main = urls[active] ?? urls[0]
  return (
    <div className="grid gap-1.5 sm:grid-cols-[3fr_1fr]">
      <Photo src={main} alt={alt} isLoading={isLoading} emoji={emoji} color={color} eager className="aspect-[16/10] w-full rounded-2xl" />
      {urls.length > 1 && (
        <div className="flex gap-1.5 sm:flex-col">
          {urls.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === active}
              className={cn('min-h-0 flex-1 overflow-hidden rounded-xl ring-offset-2 ring-offset-card transition', i === active ? 'ring-2 ring-[var(--color-honey)]' : 'opacity-80 hover:opacity-100')}
            >
              <Photo src={u} alt={`${alt} photo ${i + 1}`} emoji={emoji} color={color} className="aspect-[4/3] size-full sm:aspect-auto" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GoogleReviews({ details, isLoading }: { details: PlaceDetails | null; isLoading: boolean }) {
  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-muted" />
  if (!details?.reviews.length) return <p className="text-xs text-muted-foreground">No Google reviews available for this place.</p>
  return (
    <ul className="space-y-2" data-testid="google-reviews">
      {details.reviews.map((r, i) => (
        <li key={`${r.author}-${i}`} className="rounded-xl bg-muted/60 p-3 text-xs">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <b className="font-semibold">{r.author}</b>
            {r.rating != null && <Stars value={r.rating} />}
            {r.when && <span className="text-muted-foreground">{r.when}</span>}
          </p>
          <p className="mt-1 leading-relaxed text-foreground/90">{r.text}</p>
        </li>
      ))}
    </ul>
  )
}

function TripHiverReviews({ community, money }: { community: Community; money: TripMoney }) {
  const { person } = usePeople()
  if (!community.reviews.length) return <p className="text-xs text-muted-foreground">No TripHiver reviews yet. Be the first after you go.</p>
  return (
    <ul className="space-y-2" data-testid="triphiver-reviews">
      {community.reviews.map((r) => (
        <li key={r.id} className="flex gap-2.5 rounded-xl border border-border p-3 text-xs">
          <PersonAvatar uid={r.userId} size={30} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2">
              <b className="font-semibold">{person(r.userId).name}</b>
              <Stars value={r.rating} />
              {typeof r.spentUsd === 'number' && <span className="text-muted-foreground">spent {money.local(r.spentUsd)}</span>}
            </p>
            {r.text && <p className="mt-1 leading-relaxed text-foreground/90">{r.text}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-honey/15 px-2.5 py-1 text-xs">
          {t}
        </span>
      ))}
    </div>
  )
}

function LinkButton({ href, icon, label, isPrimary }: { href: string; icon: React.ReactNode; label: string; isPrimary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition',
        isPrimary ? 'bg-foreground text-background hover:opacity-90' : 'border border-border hover:bg-muted',
      )}
    >
      {icon} {label}
    </a>
  )
}

export function PlaceSheet({ stop, destination, money, onClose }: PlaceSheetProps) {
  const meta = CATEGORY_META[stop.category ?? 'other'] ?? CATEGORY_META.other
  const card = useHiveCard(stop.tripId, stop.title)
  const community = useCommunity(stop.title, destination)
  const photos = usePlacePhotos({ q: stop.title, near: destination, lat: stop.lat, lng: stop.lng, max: SHEET_PHOTOS })
  const { details, isLoading } = usePlaceDetails({ name: stop.title, destination, lat: stop.lat, lng: stop.lng })
  const [isRating, setIsRating] = useState(false)

  const rating = details?.rating ?? stop.rating ?? card?.rating
  const ratingCount = details?.ratingCount ?? stop.ratingCount ?? card?.ratingCount
  const cost = stop.costPerPerson ?? card?.costPerPersonUsd ?? community.avgSpentUsd ?? undefined
  const time = [stop.start, stop.end].filter(Boolean).join('–')
  const links = mapsLinks(stop, destination)
  const nearby = [...(card?.thingsToDo ?? []), ...(card?.nearbyFood ?? [])]
  const about = details?.summary ?? card?.why ?? stop.notes

  return (
    <Modal open onClose={onClose} size="xl" data-testid="place-sheet">
      <div className="space-y-5 overflow-y-auto pr-1">
        <Mosaic urls={photos.urls} isLoading={photos.isLoading} alt={stop.title} emoji={meta.emoji} color={meta.color} />

        <header className="space-y-1.5">
          <Modal.Title className="font-display text-2xl font-semibold leading-tight">{stop.title}</Modal.Title>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {meta.emoji} {details?.kind ?? meta.label}
            </span>
            {time && <span>{time}</span>}
            {typeof cost === 'number' && <span>{cost > 0 ? `${money.local(cost)} per person` : 'Free'}</span>}
            {details?.openNow != null && (
              <span className={cn('rounded-full px-2 py-0.5 font-semibold', details.openNow ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive')}>
                {details.openNow ? 'Open now' : 'Closed now'}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {typeof rating === 'number' && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-4 fill-[var(--color-honey)] text-[var(--color-honey)]" aria-hidden />
                <b>{rating.toFixed(1)}</b>
                {ratingCount ? <span className="text-xs text-muted-foreground">{ratingCount.toLocaleString()} Google ratings</span> : null}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <HiveAvatar size={20} />
              {community.count ? (
                <>
                  <b>{community.avgRating?.toFixed(1)}</b>
                  <span className="text-xs text-muted-foreground">
                    {community.count} TripHiver{community.count === 1 ? '' : 's'}
                    {community.avgSpentUsd != null && ` · spent ~${money.local(community.avgSpentUsd)}`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No TripHiver ratings yet</span>
              )}
            </span>
          </div>
          {(details?.address ?? stop.address) && (
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {details?.address ?? stop.address}
            </p>
          )}
        </header>

        {about && <p className="text-sm leading-relaxed text-foreground/90">{about}</p>}

        {(card?.mustTry?.length || nearby.length) ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {!!card?.mustTry?.length && (
              <Section title="Hive says: must try">
                <Chips items={card.mustTry} />
              </Section>
            )}
            {!!nearby.length && (
              <Section title="Hive says: do nearby">
                <Chips items={nearby} />
              </Section>
            )}
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <Section title="TripHivers say">
            <TripHiverReviews community={community} money={money} />
            {isRating ? (
              <div className="-mx-3">
                <RateRow tripId={stop.tripId} name={stop.title} onDone={() => setIsRating(false)} />
              </div>
            ) : (
              <button type="button" onClick={() => setIsRating(true)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Star className="size-3.5" aria-hidden /> Rate this place
              </button>
            )}
          </Section>
          <Section title="From Google reviewers">
            <GoogleReviews details={details} isLoading={isLoading} />
          </Section>
        </div>

        {!!details?.hours.length && (
          <Section title="Opening hours">
            <ul className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
              {details.hours.map((h) => (
                <li key={h} className="flex items-center gap-1.5 text-foreground/85">
                  <Clock className="size-3 text-muted-foreground" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
        <LinkButton href={links.directions} icon={<Navigation className="size-3.5" aria-hidden />} label="Directions" isPrimary />
        <LinkButton href={details?.mapsUrl ?? links.open} icon={<ExternalLink className="size-3.5" aria-hidden />} label="Open in Maps" />
        {details?.website && <LinkButton href={details.website} icon={<Globe className="size-3.5" aria-hidden />} label="Website" />}
        {details?.phone && (
          <a href={`tel:${details.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted">
            <Phone className="size-3.5" aria-hidden /> {details.phone}
          </a>
        )}
      </div>
    </Modal>
  )
}
