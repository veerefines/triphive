/**
 * Hover/tap profile card for any traveler: avatar, home city, style, bio,
 * interests, languages, trips hosted and TripHiver reviews written.
 * Wraps a trigger (host chip, avatar, name); queries run only while open.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Languages, MapPin, Star } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { PersonAvatar, usePeople, type Listing } from './index'

const HOVER_DELAY_MS = 200
const MAX_INTERESTS = 5

type ProfilePeekProps = {
  uid: string
  children: ReactNode
  className?: string
  /** Accessible label for the trigger; defaults to the person's name. */
  label?: string
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl bg-muted/70 px-2 py-1.5 text-center">
      <p className="font-display text-base font-semibold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

function PeekBody({ uid }: { uid: string }) {
  const { person } = usePeople()
  const p = person(uid)
  const hosted = useQuery<Listing>('public_trips', { where: { ownerId: uid } }).records.length
  const reviews = useQuery<{ userId: string }>('place_reviews', { where: { userId: uid } }).records.length
  const prof = p.profile

  return (
    <div data-testid="profile-peek" className="w-72 p-4 text-sm">
      <div className="flex items-center gap-3">
        <PersonAvatar uid={uid} size={52} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold leading-tight">{p.name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {prof?.homeCity && (
              <>
                <MapPin className="size-3" aria-hidden /> {prof.homeCity} ·{' '}
              </>
            )}
            {prof?.travelStyle || 'Traveler'}
          </p>
        </div>
      </div>

      {prof?.bio && <p className="mt-3 line-clamp-3 text-[13px] text-foreground/90">{prof.bio}</p>}

      {!!prof?.interests?.length && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {prof.interests.slice(0, MAX_INTERESTS).map((i) => (
            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
              {i}
            </span>
          ))}
        </div>
      )}

      {prof?.languages && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Languages className="size-3" aria-hidden /> {prof.languages}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Stat value={hosted} label="Hosting" />
        <Stat value={reviews} label="Reviews" />
      </div>

      <Link
        to={`/people/${uid}`}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
      >
        <Star className="size-3.5" aria-hidden /> View profile
      </Link>
    </div>
  )
}

export function ProfilePeek({ uid, children, className, label }: ProfilePeekProps) {
  const { person } = usePeople()
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={HOVER_DELAY_MS}
        aria-label={label ?? `About ${person(uid).name}`}
        className={cn('cursor-pointer rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="top" align="start">
        <PeekBody uid={uid} />
      </PopoverContent>
    </Popover>
  )
}
