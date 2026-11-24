/**
 * Shared pieces for the social layer: people (profile + avatar), public trip
 * cards and TripHive Featured place cards.
 */
import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getUserColor, useAuth, useQuery, useUsers } from 'deepspace'
import { BadgeCheck, CalendarDays, MapPin, Star, Users } from 'lucide-react'
import { cn } from '@/components/ui'
import type { FeaturedPlace } from '@/data/featured'
import { DestinationCover } from './DestinationCover'
import { PlaceImage } from '@/components/ui/PlaceImage'
import { ProfilePeek } from './ProfilePeek'
import { useConnectedProfiles } from './useConnectedProfiles'

export type Profile = {
  userId: string
  displayName?: string
  avatarEmoji?: string
  homeCity?: string
  bio?: string
  travelStyle?: string
  interests?: string[]
  languages?: string
  /** 1 = listed on the People page. */
  isPublic?: number
}

export type Listing = {
  tripId: string
  ownerId: string
  hostName?: string
  title: string
  destination: string
  lat?: number
  lng?: number
  startDate: string
  endDate: string
  description?: string
  vibes?: string[]
  openSpots?: number
  memberCount?: number
  highlights?: { date: string; titles: string[] }[]
}

export type JoinRequest = {
  tripId: string
  tripTitle: string
  destination: string
  startDate: string
  endDate: string
  requesterId: string
  ownerId: string
  participants: string[]
  pitch: string
  status: 'pending' | 'accepted' | 'declined'
  lastMessageAt: string
}

export const VIBES = ['Foodie', 'Chill', 'Adventure', 'Culture', 'Nightlife', 'Nature', 'Budget', 'Photography', 'Solo-friendly'] as const
export const VIBE_EMOJI: Record<string, string> = {
  Foodie: '🍜', Chill: '🌴', Adventure: '🧗', Culture: '🏛️', Nightlife: '🪩', Nature: '🌿', Budget: '💸', Photography: '📸', 'Solo-friendly': '🎒',
}

/**
 * Profiles + account names, resolved per user id. Synced rows cover the
 * caller and listed travelers; hidden profiles of connected travelers come
 * from the connectedProfiles action.
 */
export function usePeople() {
  const { records } = useQuery<Profile>('profiles', {})
  const { users } = useUsers()
  const { userId } = useAuth()
  const connected = useConnectedProfiles(userId)
  const person = useCallback(
    (uid: string) => {
      const p = records.find((r) => r.data.userId === uid)?.data ?? connected.find((c) => c.userId === uid)
      const u = users.find((x) => x.id === uid)
      return {
        userId: uid,
        name: p?.displayName || u?.name || 'Traveler',
        emoji: p?.avatarEmoji || '🧳',
        profile: p,
        color: getUserColor(uid),
      }
    },
    [records, users, connected],
  )
  return { person, profiles: records }
}

export function PersonAvatar({ uid, size = 36, ring = false, className }: { uid: string; size?: number; ring?: boolean; className?: string }) {
  const { person } = usePeople()
  const p = person(uid)
  return (
    <span
      title={p.name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full', ring && 'ring-2 ring-card', className)}
      style={{ width: size, height: size, fontSize: size * 0.5, background: `${p.color}22` }}
    >
      {p.emoji}
    </span>
  )
}

export function fmtDate(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function PublicTripCard({
  listing: l,
  badge,
  action,
  delay = 0,
}: {
  listing: Listing
  badge?: string
  action?: ReactNode
  delay?: number
}) {
  const { person } = usePeople()
  const host = person(l.ownerId)
  const spots = Number(l.openSpots ?? 0)
  return (
    <div className="anim-in group/pt overflow-hidden rounded-3xl border border-border bg-card card-lift" style={{ animationDelay: `${delay}ms` }} data-testid="public-trip">
      <Link to={`/discover/${l.tripId}`} className="group relative block h-40 overflow-hidden bg-muted">
        <DestinationCover
          destination={l.destination}
          lat={l.lat}
          lng={l.lng}
          seedKey={l.tripId}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--color-honey)] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-white shadow">
            {badge}
          </span>
        )}
        <span className={cn('absolute right-3 top-3 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold shadow', spots > 0 ? 'bg-white/90 text-[#1c1814]' : 'bg-black/60 text-white')}>
          {spots > 0 ? `${spots} spot${spots === 1 ? '' : 's'} open` : 'Full'}
        </span>
        <p className="absolute bottom-3 left-4 flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/85">
          <MapPin className="size-3" /> {l.destination}
        </p>
      </Link>
      <div className="p-4">
        <Link to={`/discover/${l.tripId}`} className="font-display text-lg font-semibold leading-tight hover:underline">
          {l.title}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <CalendarDays className="size-3.5" /> {fmtDate(l.startDate)} – {fmtDate(l.endDate)}
          <span>·</span>
          <Users className="size-3.5" /> {l.memberCount ?? 1} going
        </p>
        {!!l.vibes?.length && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {l.vibes.slice(0, 3).map((v) => (
              <span key={v} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                {VIBE_EMOJI[v] ?? '✨'} {v}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <ProfilePeek uid={l.ownerId} className="flex min-w-0 items-center gap-2 text-sm hover:underline">
            <PersonAvatar uid={l.ownerId} size={26} />
            <span className="truncate">
              <span className="text-muted-foreground">Hosted by </span>
              {l.hostName || host.name}
            </span>
          </ProfilePeek>
          {action}
        </div>
      </div>
    </div>
  )
}

export function FeaturedCard({ place: f, action, compact = false }: { place: FeaturedPlace; action?: ReactNode; compact?: boolean }) {
  const emoji = { food: '🍽️', sight: '🏛️', activity: '🎟️', stay: '🛏️' }[f.category]
  return (
    <div data-testid="featured-place" className={cn('relative flex shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-card', compact ? 'w-64' : 'w-72')}>
      <div className="group relative flex h-32 items-end overflow-hidden bg-gradient-to-br from-[var(--color-honey-soft)] to-[var(--color-muted)] p-3">
        <PlaceImage query={{ q: f.name, near: f.city, lat: f.lat, lng: f.lng }} alt={f.name} emoji={emoji} className="absolute inset-0" imgClassName="group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="relative inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-mono text-[10.5px] font-semibold text-background">
          <BadgeCheck className="size-3.5 text-[var(--color-honey)]" /> TripHive Verified
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold leading-snug">{f.name}</p>
        <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          {f.rating && (
            <span className="flex items-center gap-0.5 text-foreground">
              <Star className="size-3 fill-[var(--color-honey)] text-honey" /> {f.rating.toFixed(1)}
            </span>
          )}
          <span>{f.city}</span>
          {typeof f.priceFrom === 'number' && (
            <span>
              · from <b className="text-foreground">${f.priceFrom}</b>
              {f.priceWas && <s className="ml-1">${f.priceWas}</s>}
            </span>
          )}
        </p>
        {!compact && <p className="mt-1.5 line-clamp-2 text-xs text-foreground/75">{f.blurb}</p>}
        <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-honey-soft)] px-2.5 py-1 text-[11px] font-semibold text-[#9a3f12]">
          🎁 {f.perk}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">Demo offer · verified by {f.verifiedBy}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

export { ProfilePeek } from './ProfilePeek'
