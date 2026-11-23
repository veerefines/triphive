/**
 * Expanded place view opened from the map peek: fixed-height photo mosaic,
 * rating cards, summary, Hive's picks, opening hours, TripHiver and Google
 * reviews, and a sticky row of actions.
 */
import { ExternalLink, Globe, MapPin, Navigation, Phone } from 'lucide-react'
import { Modal, cn } from '@/components/ui'
import { usePlacePhotos } from '@/lib/usePlacePhotos'
import { usePlaceDetails } from '@/lib/usePlaceDetails'
import { CATEGORY_META } from './types'
import type { TripMoney } from './useTripMoney'
import type { PeekStop } from './MapPlacePeek'
import { useCommunity, useHiveCard } from './usePlaceInsights'
import { mapsLinks } from './placeLinks'
import { PlaceHero } from './place/PlaceHero'
import { PlaceReviews } from './place/PlaceReviews'
import { HiveChips, OpeningHours, RatingCards } from './place/PlaceFacts'

type PlaceSheetProps = {
  stop: PeekStop
  destination: string
  money: TripMoney
  onClose: () => void
}

const SHEET_PHOTOS = 4
const actionBase =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-honey)] focus-visible:ring-offset-2 focus-visible:ring-offset-card'

function Action({ href, icon, label, isPrimary, isExternal = true }: { href: string; icon: React.ReactNode; label: string; isPrimary?: boolean; isExternal?: boolean }) {
  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(actionBase, isPrimary ? 'bg-foreground text-background hover:opacity-90' : 'border border-border bg-card hover:bg-muted')}
    >
      {icon}
      <span className="max-w-[12rem] truncate">{label}</span>
    </a>
  )
}

function MetaPill({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'bad' }) {
  const toneClass = tone === 'good' ? 'bg-success/15 text-success' : tone === 'bad' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground/80'
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', toneClass)}>{children}</span>
}

export function PlaceSheet({ stop, destination, money, onClose }: PlaceSheetProps) {
  const meta = CATEGORY_META[stop.category ?? 'other'] ?? CATEGORY_META.other
  const card = useHiveCard(stop.tripId, stop.title)
  const community = useCommunity(stop.title, destination)
  const photos = usePlacePhotos({ q: stop.title, near: destination, lat: stop.lat, lng: stop.lng, max: SHEET_PHOTOS })
  const { details, isLoading } = usePlaceDetails({ name: stop.title, destination, lat: stop.lat, lng: stop.lng })

  const rating = details?.rating ?? stop.rating ?? card?.rating
  const ratingCount = details?.ratingCount ?? stop.ratingCount ?? card?.ratingCount
  const cost = stop.costPerPerson ?? card?.costPerPersonUsd ?? community.avgSpentUsd ?? undefined
  const time = [stop.start, stop.end].filter(Boolean).join('–')
  const links = mapsLinks(stop, destination)
  const nearby = [...(card?.thingsToDo ?? []), ...(card?.nearbyFood ?? [])]
  const about = details?.summary ?? card?.why ?? stop.notes
  const address = details?.address ?? stop.address
  const phoneHref = details?.phone ? `tel:${details.phone.replace(/[^\d+]/g, '')}` : undefined

  return (
    <Modal open onClose={onClose} size="xl" hideClose className="gap-0 overflow-hidden p-0 sm:p-0" data-testid="place-sheet">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PlaceHero urls={photos.urls} isLoading={photos.isLoading} alt={stop.title} emoji={meta.emoji} color={meta.color} onClose={onClose} />

        <div className="space-y-6 px-5 pb-6 pt-5 sm:px-7">
          <header className="space-y-2.5">
            <Modal.Title className="whitespace-normal break-words font-display text-2xl font-semibold leading-tight sm:text-3xl">{stop.title}</Modal.Title>
            <div className="flex flex-wrap items-center gap-1.5">
              <MetaPill>
                {meta.emoji} {details?.kind ?? meta.label}
              </MetaPill>
              {time && <MetaPill>{time}</MetaPill>}
              {typeof cost === 'number' && <MetaPill>{cost > 0 ? `${money.local(cost)} pp` : 'Free'}</MetaPill>}
              {details?.openNow != null && <MetaPill tone={details.openNow ? 'good' : 'bad'}>{details.openNow ? 'Open now' : 'Closed now'}</MetaPill>}
            </div>
            {address && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> <span className="min-w-0 break-words">{address}</span>
              </p>
            )}
          </header>

          <RatingCards rating={rating} ratingCount={ratingCount} community={community} money={money} />

          {about && <p className="max-w-prose text-[15px] leading-relaxed text-foreground/90">{about}</p>}

          {(!!card?.mustTry?.length || !!nearby.length) && (
            <div className="grid gap-5 sm:grid-cols-2">
              {!!card?.mustTry?.length && <HiveChips title="Hive says: must try" items={card.mustTry} />}
              {!!nearby.length && <HiveChips title="Hive says: do nearby" items={nearby} />}
            </div>
          )}

          {!!details?.hours.length && <OpeningHours hours={details.hours} openNow={details.openNow} />}

          <div className="border-t border-border pt-6">
            <PlaceReviews tripId={stop.tripId} name={stop.title} community={community} details={details} isLoading={isLoading} money={money} />
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-border bg-card/95 px-5 py-3 backdrop-blur sm:px-7">
        <Action href={links.directions} icon={<Navigation className="size-3.5" aria-hidden />} label="Directions" isPrimary />
        <Action href={details?.mapsUrl ?? links.open} icon={<ExternalLink className="size-3.5" aria-hidden />} label="Open in Maps" />
        {details?.website && <Action href={details.website} icon={<Globe className="size-3.5" aria-hidden />} label="Website" />}
        {phoneHref && details?.phone && <Action href={phoneHref} icon={<Phone className="size-3.5" aria-hidden />} label={details.phone} isExternal={false} />}
      </footer>
    </Modal>
  )
}
