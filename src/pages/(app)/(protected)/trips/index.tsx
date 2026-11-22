import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { CalendarDays, MapPin, Plus, Ticket } from 'lucide-react'
import { Button, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'
import { tripDates } from '@/lib/planCheck'

type Trip = { title: string; destination: string; startDate: string; endDate: string }

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
        <h1 className="font-display text-4xl font-bold text-foreground">Your trips</h1>
        <p className="mt-1 text-muted-foreground">Plan together. Hive keeps the plan honest.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          {status === 'loading' && <p className="text-muted-foreground">Loading trips…</p>}
          {status === 'ready' && trips.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
              <p className="font-display text-xl">No trips yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Start one on the right, or join a friend's with their invite code.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {trips.map((t) => (
              <Link
                key={t.recordId}
                to={`/trips/${t.recordId}`}
                className="group rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(80,55,10,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(80,55,10,0.12)]"
              >
                <div className="mb-3 h-1.5 w-12 rounded-full bg-primary/80 transition group-hover:w-20" />
                <h2 className="font-display text-xl font-semibold">{t.data.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" /> {t.data.destination}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="size-3.5" /> {t.data.startDate} → {t.data.endDate} ·{' '}
                  {tripDates(t.data.startDate, t.data.endDate).length} days
                </p>
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <form onSubmit={create} className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Plus className="size-4 text-primary" /> New trip
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

          <form onSubmit={join} className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Ticket className="size-4 text-primary" /> Join with a code
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
    </div>
  )
}
