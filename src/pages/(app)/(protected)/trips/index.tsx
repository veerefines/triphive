import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { CalendarDays, LogOut, MapPin, Plus, Ticket, Trash2 } from 'lucide-react'
import { Button, ConfirmModal, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'
import { tripDates } from '@/lib/planCheck'

type Trip = { title: string; destination: string; startDate: string; endDate: string; lat?: number; lng?: number }

/**
 * Card cover: a 3×2 mosaic of real OpenStreetMap tiles, offset so the
 * destination sits in the middle of the card.
 */
function MapCover({ lat, lng, z = 13 }: { lat?: number; lng?: number; z?: number }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const n = 2 ** z
  const fx = ((lng + 180) / 360) * n
  const r = (lat * Math.PI) / 180
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
  const tx = Math.floor(fx)
  const ty = Math.floor(fy)
  const T = 256
  // Pixel position of the destination inside a 3×2 grid starting at (tx-1, ty-1).
  const px = (fx - (tx - 1)) * T
  const py = (fy - (ty - 1)) * T
  const tiles = []
  for (let dy = -1; dy <= 0 + 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      tiles.push(
        <img
          key={`${dx},${dy}`}
          src={`https://tile.openstreetmap.org/${z}/${tx + dx}/${ty + dy}.png`}
          alt=""
          loading="lazy"
          className="absolute"
          style={{ width: T, height: T, left: (dx + 1) * T, top: (dy + 1) * T }}
        />,
      )
  return (
    <div className="th-tiles absolute left-1/2 top-1/2 transition duration-700 group-hover:scale-110" style={{ width: 3 * T, height: 3 * T, transform: `translate(${-px}px, ${-py}px)`, transformOrigin: `${px}px ${py}px` }}>
      {tiles}
    </div>
  )
}

function countdown(start: string, end: string) {
  const today = new Date().toISOString().slice(0, 10)
  if (end < today) return 'Past trip'
  if (start <= today) return 'Happening now'
  const days = Math.round((Date.parse(start) - Date.parse(today)) / 86_400_000)
  return days === 1 ? 'Tomorrow' : `In ${days} days`
}

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function addDays(d: Date, n: number) {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c.toISOString().slice(0, 10)
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
    startDate: addDays(today, 1),
    endDate: addDays(today, 3),
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">Trips</h1>
        <p className="mt-2 text-muted-foreground">Plan together. Hive keeps the plan honest.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          {status === 'loading' && <p className="text-muted-foreground">Loading trips…</p>}
          {status === 'ready' && trips.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center">
              <p className="text-4xl">🧳</p>
              <p className="font-display mt-2 text-xl">No trips yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Start one on the right, or join a friend's with their invite code.</p>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {trips.filter((t) => !hidden.has(t.recordId)).map((t) => {
              const owner = roleIn(t.recordId) === 'owner'
              return (
                <div key={t.recordId} className="group/card relative">
                <button
                  type="button"
                  onClick={() => setRemoving({ id: t.recordId, title: t.data.title, owner })}
                  aria-label={owner ? `Delete ${t.data.title}` : `Leave ${t.data.title}`}
                  title={owner ? 'Delete trip' : 'Leave trip'}
                  className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-card/95 text-muted-foreground shadow transition hover:text-destructive sm:opacity-0 sm:group-hover/card:opacity-100 focus-visible:opacity-100"
                >
                  {owner ? <Trash2 className="size-4" /> : <LogOut className="size-4" />}
                </button>
                <Link
                  to={`/trips/${t.recordId}`}
                  className="card-lift group overflow-hidden rounded-3xl border border-border bg-card"
                >
                  <div className="relative h-40 overflow-hidden bg-muted">
                    <MapCover lat={t.data.lat} lng={t.data.lng} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
                    <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[var(--color-honey)] shadow-lg" />
                    <span className="absolute left-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold shadow">
                      {countdown(t.data.startDate, t.data.endDate)}
                    </span>
                    <span className="absolute bottom-3 left-4 flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
                      <MapPin className="size-4" /> {t.data.destination}
                    </span>
                  </div>
                  <div className="p-4">
                    <h2 className="font-display text-xl font-semibold">{t.data.title}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="size-3.5" /> {fmt(t.data.startDate)} – {fmt(t.data.endDate)} ·{' '}
                      {(() => {
                        const n = tripDates(t.data.startDate, t.data.endDate).length
                        return `${n} day${n === 1 ? '' : 's'}`
                      })()}
                    </p>
                  </div>
                </Link>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <form onSubmit={create} className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 font-semibold">
              <Plus className="size-4 text-honey" /> New trip
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Name</Label>
              <Input id="title" required placeholder="Lisbon long weekend" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dest">Destination city</Label>
              <Input id="dest" required placeholder="Lisbon" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
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
          </form>

          <form onSubmit={join} className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 font-semibold">
              <Ticket className="size-4 text-honey" /> Join with a code
            </h2>
            <Input
              aria-label="Invite code"
              placeholder="ABC234"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-[0.3em]"
            />
            <Button type="submit" variant="outline" className="w-full" loading={joining} disabled={code.length !== 6}>
              Join trip
            </Button>
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
