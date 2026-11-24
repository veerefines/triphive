/**
 * People: travelers who chose to list their profile. Used to size up a
 * stranger who asked to join a trip, or to find company for the road.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowRight, Home, Languages, MapPin, Search, Users } from 'lucide-react'
import { cn } from '@/components/ui'
import { PersonAvatar, fmtDate, type Listing, type Profile } from '@/components/social'
import { filterPeople, isPublicProfile } from '@/lib/people'
import { localIsoDate } from '@/lib/localDate'

const INTERESTS = ['Street food', 'Hiking', 'Photography', 'Coffee', 'Beaches', 'Markets', 'Nightlife', 'Wellness', 'Wildlife', 'Live music', 'Museums', 'Architecture']
const MAX_CARD_INTERESTS = 4

type Hosted = Pick<Listing, 'tripId' | 'title' | 'destination' | 'startDate' | 'endDate'>

export default function PeoplePage() {
  const { userId } = useAuth()
  const { records, status } = useQuery<Profile>('profiles', {})
  const { records: listings } = useQuery<Listing>('public_trips', {})
  const [query, setQuery] = useState('')
  const [interest, setInterest] = useState<string | null>(null)
  const todayIso = localIsoDate()

  const profiles = useMemo(() => records.map((r) => r.data), [records])
  const people = filterPeople(profiles, { me: userId ?? undefined, query, interest })
  const me = profiles.find((p) => p.userId === userId)
  const listedCount = profiles.filter(isPublicProfile).length

  const nextTripBy = useMemo(() => {
    const out = new Map<string, Hosted>()
    const upcoming = listings.map((l) => l.data).filter((l) => l.endDate >= todayIso).sort((a, b) => a.startDate.localeCompare(b.startDate))
    for (const l of upcoming) if (!out.has(l.ownerId)) out.set(l.ownerId, l)
    return out
  }, [listings, todayIso])

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card px-6 py-10 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-[var(--color-honey)] opacity-20 blur-3xl" />
        <p className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-honey">People</p>
        <h1 className="font-display relative mt-2 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-5xl">
          Know who you’re <span className="italic text-honey">traveling</span> with.
        </h1>
        <p className="relative mt-3 max-w-lg text-muted-foreground">
          Travelers who list their profile. Check someone out before you accept their join request, or find company heading your way.
        </p>
        <label className="relative mt-6 flex max-w-xl items-center gap-2 rounded-full border border-border bg-background px-4 shadow-sm focus-within:border-foreground/40">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            aria-label="Search people"
            data-testid="people-search"
            placeholder="Name, city, style or interest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <p className="relative mt-3 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Users className="size-3.5" aria-hidden /> {listedCount} traveler{listedCount === 1 ? '' : 's'} listed
        </p>
      </section>

      {me && !isPublicProfile(me) && (
        <Link to="/profile" className="anim-in mt-5 flex items-center gap-3 rounded-3xl border border-dashed border-[var(--color-honey)] bg-[var(--color-honey-soft)]/50 px-5 py-4 text-sm">
          <span className="text-2xl">🙈</span>
          <span className="flex-1"><b>You’re hidden from People.</b> Turn on “List me on People” in your profile so others can find you.</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}

      <div className="scrollbar-none -mx-6 mt-8 flex gap-2 overflow-x-auto px-6 pb-1">
        {INTERESTS.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={interest === i}
            onClick={() => setInterest(interest === i ? null : i)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs transition',
              interest === i ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-foreground/40',
            )}
          >
            {i}
          </button>
        ))}
      </div>

      <section className="mt-5">
        {status === 'loading' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-64 rounded-3xl" />)}
          </div>
        ) : people.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <p className="text-4xl">🧭</p>
            <p className="font-display mt-2 text-xl">No travelers match</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Try another name, city or interest.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p, i) => <PersonCard key={p.userId} profile={p} next={nextTripBy.get(p.userId)} delay={Math.min(i, 8) * 40} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function PersonCard({ profile: p, next, delay }: { profile: Profile; next?: Hosted; delay: number }) {
  const interests = p.interests ?? []
  return (
    <Link
      to={`/people/${p.userId}`}
      data-testid="person-card"
      style={{ animationDelay: `${delay}ms` }}
      className="anim-in group flex flex-col rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <div className="flex items-center gap-3">
        <PersonAvatar uid={p.userId} size={52} />
        <div className="min-w-0">
          <p className="font-display truncate text-lg font-semibold leading-tight">{p.displayName || 'Traveler'}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {p.homeCity && <span className="flex items-center gap-1"><Home className="size-3" aria-hidden /> {p.homeCity}</span>}
            {p.travelStyle && <span>{p.travelStyle}</span>}
          </p>
        </div>
      </div>
      {p.bio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/85">{p.bio}</p>}
      {interests.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {interests.slice(0, MAX_CARD_INTERESTS).map((i) => <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px]">{i}</span>)}
          {interests.length > MAX_CARD_INTERESTS && <span className="px-1 text-[11px] text-muted-foreground">+{interests.length - MAX_CARD_INTERESTS}</span>}
        </div>
      )}
      <div className="mt-auto pt-4">
        {next ? (
          <p className="flex items-center gap-1.5 rounded-2xl bg-[var(--color-honey-soft)]/60 px-3 py-2 text-xs">
            <MapPin className="size-3.5 shrink-0 text-honey" aria-hidden />
            <span className="truncate">Hosting <b>{next.destination.split(',')[0]}</b> · {fmtDate(next.startDate)}–{fmtDate(next.endDate)}</span>
          </p>
        ) : p.languages ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Languages className="size-3.5" aria-hidden /> {p.languages}</p>
        ) : null}
      </div>
    </Link>
  )
}
