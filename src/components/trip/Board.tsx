import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { RecordData } from 'deepspace'
import { AlertTriangle, Bot, Clock, CloudRain, Lock, MapPin, Navigation, Plus, Search, Star, Sun, Trash2 } from 'lucide-react'
import { Button, Input, Label, Modal, Textarea, cn, useToast } from '@/components/ui'
import { googleDirectionsUrl, hasCoords, routeLegs } from '@/lib/geo'
import { sortDay, toMinutes } from '@/lib/planCheck'
import { callAction } from '@/lib/api'
import { CATEGORY_META, type IssueRow, type Stop, type Trip } from './types'

type Peer = { userId: string; userName: string; state: Record<string, unknown> }

export function weekday(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })
}

/** One day of the itinerary: date bubble + vertical timeline of stops with travel connectors. */
export function ItineraryDay({
  date,
  index,
  trip,
  stops,
  issues,
  peers,
  canWrite,
  selected,
  onSelect,
  onAdd,
  onEdit,
}: {
  date: string
  index: number | null
  trip: Trip
  stops: RecordData<Stop>[]
  issues: RecordData<IssueRow>[]
  peers: Peer[]
  canWrite: boolean
  selected: boolean
  onSelect: () => void
  onAdd: (date: string) => void
  onEdit: (stop: RecordData<Stop>) => void
}) {
  const ordered = useMemo(() => sortDay(stops.map((s) => ({ ...s.data, id: s.recordId, record: s }))), [stops])
  const legs = useMemo(() => routeLegs(ordered), [ordered])
  const fc = trip.forecast?.[date]
  const dayIssues = issues.filter((i) => i.data.date === date)
  const flagged = new Set(dayIssues.flatMap((i) => i.data.stopIds ?? []))
  const spend = ordered.reduce((sum, s) => sum + (typeof s.costPerPerson === 'number' ? s.costPerPerson : 0), 0)

  return (
    <section id={`day-${date}`} className="scroll-mt-4">
      <button type="button" onClick={onSelect} className="group mb-3 flex w-full items-center gap-3 text-left">
        <div
          className={cn(
            'flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-center leading-none transition',
            selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-card',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{weekday(date, { weekday: 'short' })}</span>
          <span className="mt-0.5 text-lg font-semibold">{weekday(date, { day: 'numeric' })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">
            {index != null ? `Day ${index + 1}` : 'Outside trip dates'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{weekday(date, { month: 'short', day: 'numeric' })}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
            <span>
              {ordered.length} stop{ordered.length === 1 ? '' : 's'}
            </span>
            {legs.length > 0 && <span>· {legs.reduce((a, l) => a + l.km, 0).toFixed(1)} km</span>}
            {spend > 0 && <span>· ~${spend}/pp</span>}
            {dayIssues.length > 0 && (
              <span className="flex items-center gap-1 font-medium text-warning">
                · <AlertTriangle className="size-3" /> {dayIssues.length}
              </span>
            )}
          </p>
        </div>
        {fc && (
          <div className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs shadow-[var(--shadow-card)]" title={fc.desc}>
            {fc.rain ? <CloudRain className="size-3.5 text-info" /> : <Sun className="size-3.5 text-honey" />}
            {fc.min}–{fc.max}°
          </div>
        )}
      </button>

      <div className="relative ml-6 border-l-2 border-dashed border-border pb-2 pl-7">
        {ordered.map((s, i) => {
          const leg = legs.find((l) => l.toIndex === i)
          const editors = peers.filter((p) => p.state.editingStopId === s.id)
          const meta = CATEGORY_META[s.category ?? 'other'] ?? CATEGORY_META.other
          return (
            <div key={s.id} className="relative">
              {leg && (
                <p className="-ml-1 flex items-center gap-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                  <span>
                    {leg.mode === 'walk' ? '🚶' : '🚇'} {leg.minutes} min · {leg.km} km
                  </span>
                  {(() => {
                    const a = ordered[leg.fromIndex]
                    const b = ordered[leg.toIndex]
                    const url = hasCoords(a) && hasCoords(b) ? googleDirectionsUrl([a, b], leg.mode) : null
                    return url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-honey hover:underline">
                        <Navigation className="size-3" /> directions
                      </a>
                    ) : null
                  })()}
                </p>
              )}
              <span
                className="absolute -left-[39px] top-4 flex size-5 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white"
                style={{ background: meta.color }}
              >
                {i + 1}
              </span>
              <StopCard stop={s.record} flagged={flagged.has(s.id)} editors={editors.map((e) => e.userName)} onClick={() => canWrite && onEdit(s.record)} />
            </div>
          )
        })}
        {ordered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            Nothing planned yet — add a stop or ask Hive.
          </p>
        )}
        {index != null && (
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => onAdd(date)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium transition hover:border-foreground disabled:opacity-50"
          >
            <Plus className="size-4" /> Add stop
          </button>
        )}
      </div>
    </section>
  )
}

function StopCard({ stop, flagged, editors, onClick }: { stop: RecordData<Stop>; flagged: boolean; editors: string[]; onClick: () => void }) {
  const d = stop.data
  const meta = CATEGORY_META[d.category ?? 'other'] ?? CATEGORY_META.other
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="stop-card"
      className={cn(
        'card-lift relative flex w-full items-center gap-3 rounded-2xl border bg-card p-2.5 text-left',
        flagged ? 'border-warning/60' : 'border-transparent',
        editors.length > 0 && 'ring-2 ring-info/50',
      )}
    >
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${meta.color}18` }}>
        {meta.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold leading-snug">{d.title}</p>
          {d.source === 'ai' && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-honey-soft px-1.5 py-0.5 text-[10px] font-medium text-[#8a3a14]">
              <Bot className="size-3" /> Hive
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
          {typeof d.rating === 'number' && (
            <span className="flex items-center gap-0.5 text-foreground">
              <Star className="size-3 fill-[var(--color-honey)] text-honey" />
              {d.rating.toFixed(1)}
            </span>
          )}
          <span>{meta.label}</span>
          {d.start && (
            <span className="flex items-center gap-1">
              · <Clock className="size-3" />
              {d.start}
              {d.end ? `–${d.end}` : ''}
            </span>
          )}
          {typeof d.costPerPerson === 'number' && d.costPerPerson > 0 && <span>· ${d.costPerPerson}</span>}
          {!!d.outdoor && <span>· outdoor</span>}
        </p>
        {d.address && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{d.address.split(',').slice(0, 2).join(',')}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 self-start pt-1">
        {!!d.fixedTime && <Lock className="size-3.5 text-muted-foreground" aria-label="Fixed time" />}
        {flagged && <AlertTriangle className="size-4 text-warning" aria-label="Has issues" />}
      </div>
      {editors.length > 0 && (
        <span className="absolute -top-2 right-3 rounded-full bg-info px-2 py-0.5 text-[10px] font-medium text-info-foreground">{editors[0]} is editing…</span>
      )}
    </button>
  )
}

type PlaceHit = { name: string; address: string; lat: number; lng: number; kind: string; rating?: number; ratingCount?: number; mapsUrl?: string }

const EMPTY: Partial<Stop> = { title: '', start: '', end: '', category: 'sight', notes: '', address: '', url: '' }

export function StopModal({
  open,
  tripId,
  dates,
  initial,
  stopId,
  ready,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  tripId: string
  dates: string[]
  initial: Partial<Stop>
  stopId: string | null
  ready: boolean
  onClose: () => void
  onSave: (data: Partial<Stop>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<Partial<Stop>>({ ...EMPTY, ...initial })
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initial })
      setHits([])
    }
  }, [open, stopId])

  const set = (patch: Partial<Stop>) => setForm((f) => ({ ...f, ...patch }))

  async function lookup() {
    if (!form.title || form.title.length < 2) return
    setSearching(true)
    try {
      const { places } = await callAction<{ places: PlaceHit[] }>('findPlace', { tripId, query: form.title })
      setHits(places)
      if (places.length === 0) toast.info('No map match', 'You can still save it without a location.')
    } catch (err) {
      toast.error('Lookup failed', (err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const s = toMinutes(form.start)
    const en = toMinutes(form.end)
    if (form.start && s == null) return toast.error('Start must be HH:MM')
    if (form.end && en == null) return toast.error('End must be HH:MM')
    if (s != null && en != null && en <= s) return toast.error('End must be after start')
    setSaving(true)
    try {
      const clean: Partial<Stop> = {
        ...form,
        costPerPerson: form.costPerPerson === undefined || Number.isNaN(form.costPerPerson) ? undefined : Number(form.costPerPerson),
        outdoor: !!form.outdoor,
        fixedTime: !!form.fixedTime,
      }
      await onSave(clean)
      onClose()
    } catch (err) {
      toast.error('Save failed', (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>{stopId ? 'Edit stop' : 'Add stop'}</Modal.Title>
      </Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stop-title">Place or activity</Label>
            <div className="flex gap-2">
              <Input id="stop-title" required value={form.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Pastéis de Belém" />
              <Button type="button" variant="outline" onClick={lookup} loading={searching} aria-label="Find on map">
                <Search />
              </Button>
            </div>
            {hits.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-popover text-sm">
                {hits.map((h) => (
                  <li key={`${h.lat},${h.lng}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        set({
                          title: form.title || h.name,
                          address: h.address,
                          lat: h.lat,
                          lng: h.lng,
                          rating: h.rating,
                          ratingCount: h.ratingCount,
                          url: form.url || h.mapsUrl,
                        })
                        setHits([])
                      }}
                    >
                      <span className="font-medium">{h.name}</span>
                      {typeof h.rating === 'number' && (
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          ★ {h.rating.toFixed(1)}
                          {h.ratingCount ? ` (${h.ratingCount.toLocaleString()})` : ''}
                        </span>
                      )}
                      <span className="block truncate text-xs text-muted-foreground">{h.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {typeof form.lat === 'number' && (
              <p className="flex items-center gap-1 text-xs text-success">
                <MapPin className="size-3" /> Located: {form.address?.split(',').slice(0, 3).join(',')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="stop-date">Day</Label>
              <select
                id="stop-date"
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
              >
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {weekday(d)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stop-start">Start</Label>
              <Input id="stop-start" type="time" value={form.start ?? ''} onChange={(e) => set({ start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stop-end">End</Label>
              <Input id="stop-end" type="time" value={form.end ?? ''} onChange={(e) => set({ end: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="stop-cat">Type</Label>
              <select
                id="stop-cat"
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              >
                {Object.entries(CATEGORY_META).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.emoji} {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stop-cost">Cost / person ($)</Label>
              <Input
                id="stop-cost"
                type="number"
                min={0}
                value={form.costPerPerson ?? ''}
                onChange={(e) => set({ costPerPerson: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!form.outdoor} onChange={(e) => set({ outdoor: e.target.checked })} /> Outdoors
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!form.fixedTime} onChange={(e) => set({ fixedTime: e.target.checked })} /> Fixed time (booked)
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stop-notes">Notes</Label>
            <Textarea id="stop-notes" rows={2} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stop-url">Link</Label>
            <Input id="stop-url" type="url" value={form.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          </div>
        </Modal.Body>
        <Modal.Footer className="flex justify-between">
          {stopId ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={!ready}
              onClick={async () => {
                await onDelete()
                onClose()
              }}
            >
              <Trash2 /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!ready}>
              Save
            </Button>
          </div>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
