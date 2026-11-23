/**
 * Discover: public trips from other travelers, travel-buddy matches for my
 * own trips (same area, ±5 days), and TripHive Featured places.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui'
import { FeaturedCard, PublicTripCard, VIBES, VIBE_EMOJI, fmtDate, type JoinRequest, type Listing, type Profile } from '@/components/social'
import { FEATURED, featuredNear } from '@/data/featured'
import { matchLabel, matchTrips } from '@/lib/match'
import type { Trip } from '@/components/trip/types'

export default function DiscoverPage() {
  const { userId } = useAuth()
  const { records: listings, status } = useQuery<Listing>('public_trips', { orderBy: 'startDate', orderDir: 'asc' })
  const { records: myTrips } = useQuery<Trip>('trips', {})
  const { records: myRequests } = useQuery<JoinRequest>('join_requests', { where: { requesterId: userId ?? '' } })
  const { records: myProfile } = useQuery<Profile>('profiles', { where: { userId: userId ?? '' } })

  const [where, setWhere] = useState('')
  const [around, setAround] = useState('')
  const [vibe, setVibe] = useState<string | null>(null)
  const [openOnly, setOpenOnly] = useState(false)

  const todayIso = new Date().toISOString().slice(0, 10)
  const myTripIds = useMemo(() => new Set(myTrips.map((t) => t.recordId)), [myTrips])
  const requestFor = (tripId: string) => myRequests.find((r) => r.data.tripId === tripId)?.data.status

  const others = useMemo(
    () => listings.map((l) => ({ ...l.data, id: l.data.tripId })).filter((l) => !myTripIds.has(l.tripId) && l.endDate >= todayIso),
    [listings, myTripIds, todayIso],
  )

  // Buddy matches for each of my upcoming trips.
  const matches = useMemo(() => {
    const out: { mine: string; m: ReturnType<typeof matchTrips<(typeof others)[number]>>[number] }[] = []
    for (const t of myTrips) {
      if (t.data.endDate < todayIso) continue
      for (const m of matchTrips({ ...t.data, id: t.recordId }, others)) out.push({ mine: t.data.title, m })
    }
    const seen = new Set<string>()
    return out.filter(({ m }) => (seen.has(m.trip.tripId) ? false : (seen.add(m.trip.tripId), true)))
  }, [myTrips, others, todayIso])

  const filtered = others.filter((l) => {
    if (where && !`${l.destination} ${l.title}`.toLowerCase().includes(where.toLowerCase())) return false
    if (vibe && !(l.vibes ?? []).includes(vibe)) return false
    if (openOnly && Number(l.openSpots ?? 0) <= 0) return false
    if (around) {
      const [s, e] = [Date.parse(l.startDate), Date.parse(l.endDate)]
      const a = Date.parse(around)
      if (a < s - 5 * 86_400_000 || a > e + 5 * 86_400_000) return false
    }
    return true
  })

  const featured = where ? featuredNear({ destination: where }) : FEATURED
  const actionFor = (tripId: string, spots: number) => {
    const st = requestFor(tripId)
    if (st === 'pending') return <span className="rounded-full bg-muted px-3 py-1.5 font-mono text-[11px]">Requested</span>
    if (st === 'accepted') return <Link to={`/trips/${tripId}`} className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success">Joined · open</Link>
    if (spots <= 0) return null
    return (
      <Link to={`/discover/${tripId}`} className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90">
        Ask to join
      </Link>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">
      {/* Hero + search */}
      <section className="relative overflow-hidden rounded-[32px] bg-foreground px-6 py-10 text-background sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[var(--color-honey)] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-[#2563eb] opacity-15 blur-3xl" />
        <p className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-background/60">Discover</p>
        <h1 className="font-display relative mt-2 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-6xl">
          Find your <span className="italic text-[var(--color-honey)]">people</span> for the road.
        </h1>
        <p className="relative mt-3 max-w-lg text-background/70">
          Join public trips from travelers heading the same way, or open yours to meet new people. Solo? Groups welcome you here.
        </p>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            document.getElementById('discover-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="relative mt-7 flex max-w-3xl flex-col gap-2 rounded-3xl bg-background p-2 text-foreground shadow-xl sm:flex-row sm:items-center sm:rounded-full"
        >
          <label className="flex flex-1 items-center gap-2 px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              aria-label="Where to"
              placeholder="Where to? Lisbon, Tokyo, Shillong…"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-full bg-muted px-3 sm:w-56">
            <span className="font-mono text-[10.5px] text-muted-foreground">Around</span>
            <input aria-label="Around date" type="date" value={around} onChange={(e) => setAround(e.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <span className="hidden shrink-0 rounded-full bg-[var(--color-honey-soft)] px-3 py-2 font-mono text-[11px] font-semibold text-[#9a3f12] sm:inline">±5 days</span>
          <button
            type="submit"
            data-testid="discover-search"
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--color-honey)] px-5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Search className="size-4" aria-hidden /> Search
          </button>
        </form>
      </section>

      {myProfile.length === 0 && (
        <Link
          to="/profile"
          className="anim-in mt-5 flex items-center gap-3 rounded-3xl border border-dashed border-[var(--color-honey)] bg-[var(--color-honey-soft)]/50 px-5 py-4 text-sm"
        >
          <span className="text-2xl">👋</span>
          <span className="flex-1">
            <b>Set up your traveler profile</b> — hosts see it when you ask to join.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      {/* Buddy matches */}
      {matches.length > 0 && (
        <section className="mt-10">
          <SectionHead eyebrow="Heading your way" title="Travelers near your dates" hint="Same area, within ±5 days of your trips" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {matches.slice(0, 6).map(({ mine, m }, i) => (
              <PublicTripCard
                key={m.trip.tripId}
                listing={m.trip}
                badge={`${matchLabel(m)} · ${mine}`}
                delay={i * 50}
                action={actionFor(m.trip.tripId, Number(m.trip.openSpots ?? 0))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="mt-10">
        <SectionHead
          eyebrow="TripHive Featured"
          title={where && featured.length ? `Verified in ${featured[0].city}` : 'Verified spots with member perks'}
          hint="Hand-checked by local TripHive hosts"
        />
        {featured.length === 0 ? (
          <p className="text-sm text-muted-foreground">No featured places there yet — we’re verifying new cities every week.</p>
        ) : (
          <div className="scrollbar-none -mx-6 flex gap-4 overflow-x-auto px-6 pb-2">
            {featured.map((f) => (
              <FeaturedCard key={f.id} place={f} />
            ))}
          </div>
        )}
      </section>

      {/* Public trips */}
      <section id="discover-results" className="mt-10 scroll-mt-6">
        <SectionHead eyebrow="Open trips" title="Public trips you can join" />
        <div className="scrollbar-none -mx-6 mb-5 flex gap-2 overflow-x-auto px-6">
          <Chip active={openOnly} onClick={() => setOpenOnly((v) => !v)}>
            🎒 Has open spots
          </Chip>
          {VIBES.map((v) => (
            <Chip key={v} active={vibe === v} onClick={() => setVibe(vibe === v ? null : v)}>
              {VIBE_EMOJI[v]} {v}
            </Chip>
          ))}
        </div>
        {status === 'loading' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-72 rounded-3xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <p className="text-4xl">🗺️</p>
            <p className="font-display mt-2 text-xl">No open trips match yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Be the first: open one of your trips to the community from its page (Private → Public).
            </p>
            <Link to="/trips" className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Go to my trips
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l, i) => (
              <PublicTripCard key={l.tripId} listing={l} delay={Math.min(i, 8) * 50} action={actionFor(l.tripId, Number(l.openSpots ?? 0))} />
            ))}
          </div>
        )}
      </section>
      <p className="mt-8 flex items-center justify-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
        <Sparkles className="size-3" /> Public trips show title, dates and highlights only — never invite codes or the full plan. Updated {fmtDate(todayIso)}.
      </p>
    </div>
  )
}

function SectionHead({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-honey">{eyebrow}</p>
        <h2 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {hint && <p className="font-mono text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs transition',
        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-foreground/40',
      )}
    >
      {children}
    </button>
  )
}
