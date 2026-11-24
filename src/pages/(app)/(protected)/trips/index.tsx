import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowRight, CalendarDays, LogOut, MapPin, Plus, Ticket, Trash2 } from 'lucide-react'
import { Button, ConfirmModal, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'
import { tripDates } from '@/lib/planCheck'
import { addLocalDays, localIsoDate } from '@/lib/localDate'
import { DestinationCover } from '@/components/social/DestinationCover'

type Trip = { title: string; destination: string; startDate: string; endDate: string; lat?: number; lng?: number; visibility?: string }

function countdown(start: string, end: string) {
  const today = localIsoDate()
  if (end < today) return 'Past trip'
  if (start <= today) return 'Happening now'
  const days = Math.round((Date.parse(start) - Date.parse(today)) / 86_400_000)
  return days === 1 ? 'Tomorrow' : `In ${days} days`
}

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function TripsPage() {
  // RBAC ('team') means this only ever returns trips the user belongs to.
  const { records: trips, status } = useQuery<Trip>('trips', { orderBy: 'startDate', orderDir: 'asc' })
  const navigate = useNavigate()
  const toast = useToast()
  const { userId } = useAuth()
  // My membership rows (RBAC 'team' scopes these to my trips) → owner vs member per trip.
  const { records: memberships } = useQuery<{ teamId: string; userId: string; role: string }>('team_members', {
    where: { userId: userId ?? '' },
  })
  const roleIn = (tripId: string) => memberships.find((m) => m.data.teamId === tripId)?.data.role
  const [removing, setRemoving] = useState<{ id: string; title: string; owner: boolean } | null>(null)
  // The live query may keep a cached row after membership is revoked; hide it at once.
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  async function confirmRemove() {
    if (!removing) return
    try {
      await callAction(removing.owner ? 'deleteTrip' : 'leaveTrip', { tripId: removing.id })
      setHidden((h) => new Set(h).add(removing.id))
      toast.success(removing.owner ? 'Trip deleted' : 'You left the trip', removing.title)
    } catch (err) {
      toast.error(removing.owner ? 'Could not delete' : 'Could not leave', (err as Error).message)
    } finally {
      setRemoving(null)
    }
  }
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const today = new Date()
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: addLocalDays(today, 1),
    endDate: addLocalDays(today, 3),
  })

  async function create(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const { tripId } = await callAction<{ tripId: string }>('createTrip', form)
      navigate(`/trips/${tripId}`)
    } catch (err) {
      toast.error('Could not create trip', (err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    setJoining(true)
    try {
      const { tripId } = await callAction<{ tripId: string }>('joinTrip', { code })
      navigate(`/trips/${tripId}`)
    } catch (err) {
      toast.error('Could not join', (err as Error).message)
    } finally {
      setJoining(false)
    }
  }

  const todayIso = localIsoDate(today)
  const visible = trips.filter((t) => !hidden.has(t.recordId))
  const upcoming = visible.filter((t) => t.data.endDate >= todayIso)
  const past = visible.filter((t) => t.data.endDate < todayIso).reverse()
  const [next, ...laterTrips] = upcoming
  const plannedDays = upcoming.reduce((n, t) => n + tripDates(t.data.startDate, t.data.endDate).length, 0)
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const card = (t: (typeof trips)[number], idx: number, variant: 'feature' | 'grid' | 'past') => (
    <TripCard
      key={t.recordId}
      id={t.recordId}
      trip={t.data}
      owner={roleIn(t.recordId) === 'owner'}
      variant={variant}
      delay={Math.min(idx, 8) * 50}
      onRemove={(owner) => setRemoving({ id: t.recordId, title: t.data.title, owner })}
    />
  )

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{greeting}</p>
          <h1 className="font-display mt-1 text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Where <span className="italic text-honey">to</span> next?
          </h1>
        </div>
        {status === 'ready' && visible.length > 0 && (
          <div className="flex flex-wrap gap-2 font-mono text-[11px]">
            <a href="#new-trip" className="rounded-full bg-foreground px-3 py-1.5 font-semibold text-background lg:hidden">
              + New trip
            </a>
            <span className="rounded-full border border-border bg-card px-3 py-1.5">
              <b className="text-foreground">{upcoming.length}</b> <span className="text-muted-foreground">upcoming</span>
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1.5">
              <b className="text-foreground">{plannedDays}</b> <span className="text-muted-foreground">days planned</span>
            </span>
          </div>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-8">
          {status === 'loading' && (
            <div className="space-y-5" aria-busy="true" aria-label="Loading trips">
              <div className="skeleton h-72 rounded-[28px]" />
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="skeleton h-56 rounded-3xl" />
                <div className="skeleton h-56 rounded-3xl" />
              </div>
            </div>
          )}
          {status === 'ready' && visible.length === 0 && (
            <div className="anim-in relative overflow-hidden rounded-[28px] border border-border bg-card p-10 text-center sm:p-14">
              <div className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-[var(--color-honey-soft)] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-10 size-56 rounded-full bg-[var(--color-honey-soft)] blur-3xl" />
              <div className="relative">
                <p className="text-5xl">🧳</p>
                <p className="font-display mt-3 text-2xl font-semibold">Your first trip starts here</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  Name it, pick a city and dates. Then share the code — friends plan alongside you in real time.
                </p>
                <ol className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2 font-mono text-[11px] text-muted-foreground">
                  {['Create a trip', 'Share the code', 'Ask Hive to plan', 'Vote on changes'].map((s, i) => (
                    <li key={s} className="rounded-full border border-border bg-background px-3 py-1.5">
                      <span className="text-honey">{i + 1}</span> {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {next && (
            <div>
              <SectionLabel>Next up</SectionLabel>
              {card(next, 0, 'feature')}
            </div>
          )}
          {laterTrips.length > 0 && (
            <div>
              <SectionLabel>Later</SectionLabel>
              <div className="grid gap-5 sm:grid-cols-2">{laterTrips.map((t, i) => card(t, i + 1, 'grid'))}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <SectionLabel>Past trips</SectionLabel>
              <div className="grid gap-5 sm:grid-cols-2">{past.map((t, i) => card(t, i, 'past'))}</div>
            </div>
          )}
        </section>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <form id="new-trip" onSubmit={create} className="scroll-mt-24 overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="relative bg-[var(--color-honey-soft)] px-5 pb-4 pt-5">
              <div className="pointer-events-none absolute -right-6 -top-8 text-7xl opacity-20">🗺️</div>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
                  <Plus className="size-4" />
                </span>
                New trip
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">We pull the forecast and map for you.</p>
            </div>
            <div className="space-y-3 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Name</Label>
                <Input id="title" required placeholder="Lisbon long weekend" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dest">Destination city</Label>
                <Input id="dest" required placeholder="Lisbon" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
                {[
                  { label: 'Weekend', days: 2 },
                  { label: '4 days', days: 3 },
                  { label: 'A week', days: 6 },
                ].map((p) => {
                  const end = addLocalDays(new Date(`${form.startDate}T12:00:00`), p.days)
                  const active = form.endDate === end
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setForm({ ...form, endDate: end })}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${
                        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:border-foreground/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="start">From</Label>
                  <Input id="start" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">To</Label>
                  <Input id="end" type="date" required min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" loading={creating}>
                Create trip
              </Button>
            </div>
          </form>

          <form onSubmit={join} className="space-y-3 rounded-3xl bg-foreground p-5 text-background shadow-[var(--shadow-card)]">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Ticket className="size-4 text-honey" /> Got an invite?
              </h2>
              <p className="mt-0.5 text-xs text-background/60">Enter the 6-character code a friend shared.</p>
            </div>
            <div className="flex gap-2">
              <input
                aria-label="Invite code"
                placeholder="ABC234"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="h-10 min-w-0 flex-1 rounded-full border border-background/15 bg-background/10 px-4 font-mono text-sm tracking-[0.3em] text-background outline-none placeholder:text-background/35 focus:border-[var(--color-honey)]"
              />
              <button
                type="submit"
                disabled={code.length !== 6 || joining}
                className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-[var(--color-honey)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {joining ? 'Joining…' : 'Join trip'}
              </button>
            </div>
          </form>
        </aside>
      </div>
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing?.owner ? `Delete “${removing.title}”?` : `Leave “${removing?.title ?? ''}”?`}
        description={
          removing?.owner
            ? 'This removes every stop, vote and preference for all travelers. It cannot be undone.'
            : 'You will lose access until someone shares the invite code again.'
        }
        confirmText={removing?.owner ? 'Delete trip' : 'Leave trip'}
        variant="destructive"
        onConfirm={confirmRemove}
      />
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{children}</h2>
}

function TripCard({
  id,
  trip: t,
  owner,
  variant,
  delay,
  onRemove,
}: {
  id: string
  trip: Trip
  owner: boolean
  variant: 'feature' | 'grid' | 'past'
  delay: number
  onRemove: (owner: boolean) => void
}) {
  const days = tripDates(t.startDate, t.endDate).length
  const feature = variant === 'feature'
  return (
    <div className="anim-in group/card relative" style={{ animationDelay: `${delay}ms` }}>
      <button
        type="button"
        onClick={() => onRemove(owner)}
        aria-label={owner ? `Delete ${t.title}` : `Leave ${t.title}`}
        title={owner ? 'Delete trip' : 'Leave trip'}
        className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-destructive sm:opacity-0 sm:group-hover/card:opacity-100 focus-visible:opacity-100"
      >
        {owner ? <Trash2 className="size-4" /> : <LogOut className="size-4" />}
      </button>
      <Link
        to={`/trips/${id}`}
        className={`card-lift group relative block overflow-hidden border border-border bg-muted ${
          feature ? 'h-72 rounded-[28px] sm:h-80' : 'h-56 rounded-3xl'
        } ${variant === 'past' ? 'grayscale-[0.7] hover:grayscale-0' : ''}`}
      >
        <DestinationCover
          destination={t.destination}
          lat={t.lat}
          lng={t.lng}
          seedKey={id}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/0" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#1c1814] shadow-sm backdrop-blur">
          {countdown(t.startDate, t.endDate)}
        </span>
        {t.visibility === 'public' && (
          <span className="absolute left-3 top-11 rounded-full bg-success px-2.5 py-1 font-mono text-[10.5px] font-semibold text-white shadow-sm">🌍 Public</span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
          <p className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/75">
            <MapPin className="size-3" /> {t.destination}
          </p>
          <h2 className={`font-display mt-1 font-semibold leading-tight drop-shadow ${feature ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>{t.title}</h2>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-white/80">
              <CalendarDays className="size-3.5" /> {fmt(t.startDate)} – {fmt(t.endDate)} · {days} day{days === 1 ? '' : 's'}
            </p>
            {feature && (
              <span className="hidden items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1c1814] transition group-hover:gap-2 sm:inline-flex">
                Open plan <ArrowRight className="size-3.5" />
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
