import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { RecordData } from 'deepspace'
import { AlertTriangle, Bot, Clock, CloudRain, Lock, MapPin, Plus, Search, Sun, Trash2 } from 'lucide-react'
import { Button, Input, Label, Modal, Textarea, cn, useToast } from '@/components/ui'
import { routeLegs } from '@/lib/geo'
import { sortDay, toMinutes } from '@/lib/planCheck'
import { callAction } from '@/lib/api'
import { CATEGORY_META, type IssueRow, type Stop, type Trip } from './types'

type Peer = { userId: string; userName: string; state: Record<string, unknown> }

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function DayColumn({
  date,
  trip,
  stops,
  issues,
  peers,
  canWrite,
  onAdd,
  onEdit,
}: {
  date: string
  trip: Trip
  stops: RecordData<Stop>[]
  issues: RecordData<IssueRow>[]
  peers: Peer[]
  canWrite: boolean
  onAdd: (date: string) => void
  onEdit: (stop: RecordData<Stop>) => void
}) {
  const ordered = useMemo(() => {
    const like = stops.map((s) => ({ ...s.data, id: s.recordId, record: s }))
    return sortDay(like)
  }, [stops])
  const legs = useMemo(() => routeLegs(ordered), [ordered])
  const fc = trip.forecast?.[date]
  const dayIssues = issues.filter((i) => i.data.date === date)
  const flagged = new Set(dayIssues.flatMap((i) => i.data.stopIds ?? []))

  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-border bg-[var(--color-shell-panel)]">
      <div className="flex items-start justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-display text-lg font-semibold leading-tight">{weekday(date)}</p>
          <p className="text-xs text-muted-foreground">
            {ordered.length} stop{ordered.length === 1 ? '' : 's'}
            {dayIssues.length > 0 && (
              <span className="ml-1.5 text-warning">· {dayIssues.length} issue{dayIssues.length === 1 ? '' : 's'}</span>
            )}
          </p>
        </div>
        {fc ? (
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs" title={fc.desc}>
            {fc.rain ? <CloudRain className="size-3.5 text-info" /> : <Sun className="size-3.5 text-primary" />}
            {fc.min}–{fc.max}°
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground" title="Forecasts cover the next 5 days">no forecast</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0 p-3">
        {ordered.map((s, i) => {
          const leg = legs.find((l) => l.toIndex === i)
          const editors = peers.filter((p) => p.state.editingStopId === s.id)
          return (
            <div key={s.id}>
              {leg && (
                <div className="flex items-center gap-2 py-1 pl-4 text-[11px] text-muted-foreground">
                  <span className="h-4 border-l border-dashed border-border" />
                  {leg.mode === 'walk' ? '🚶' : '🚇'} ~{leg.minutes} min · {leg.km} km
                </div>
              )}
              <StopCard
                stop={s.record}
                flagged={flagged.has(s.id)}
                editors={editors.map((e) => e.userName)}
                onClick={() => canWrite && onEdit(s.record)}
              />
            </div>
          )
        })}
        {ordered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing planned yet</p>}
        <button
          type="button"
          disabled={!canWrite}
          onClick={() => onAdd(date)}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Plus className="size-4" /> Add stop
        </button>
      </div>
    </div>
  )
}

function StopCard({
  stop,
  flagged,
  editors,
  onClick,
}: {
  stop: RecordData<Stop>
  flagged: boolean
  editors: string[]
  onClick: () => void
}) {
  const d = stop.data
  const meta = CATEGORY_META[d.category ?? 'other'] ?? CATEGORY_META.other
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="stop-card"
      className={cn(
        'relative w-full rounded-xl border bg-card p-3 text-left shadow-[0_1px_2px_rgba(80,55,10,0.06)] transition hover:shadow-[0_4px_12px_rgba(80,55,10,0.1)]',
        flagged ? 'border-warning/70' : 'border-border',
        editors.length > 0 && 'ring-2 ring-info/50',
      )}
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">
          <span className="mr-1">{meta.emoji}</span>
          {d.title}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {d.source === 'ai' && <Bot className="size-3.5 text-primary" aria-label="Suggested by Hive" />}
          {!!d.fixedTime && <Lock className="size-3 text-muted-foreground" aria-label="Fixed time" />}
          {flagged && <AlertTriangle className="size-3.5 text-warning" aria-label="Has issues" />}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {d.start && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {d.start}
            {d.end ? `–${d.end}` : ''}
          </span>
        )}
        {typeof d.costPerPerson === 'number' && d.costPerPerson > 0 && <span>${d.costPerPerson}/pp</span>}
        {!!d.outdoor && <span>outdoor</span>}
        {d.address && (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{d.address.split(',').slice(0, 2).join(',')}</span>
          </span>
        )}
      </div>
      {editors.length > 0 && (
        <span className="absolute -top-2 right-2 rounded-full bg-info px-2 py-0.5 text-[10px] font-medium text-info-foreground">
          {editors[0]} is editing…
        </span>
      )}
    </button>
  )
}

type PlaceHit = { name: string; address: string; lat: number; lng: number; kind: string }

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
                        set({ title: form.title || h.name, address: h.address, lat: h.lat, lng: h.lng })
                        setHits([])
                      }}
                    >
                      <span className="font-medium">{h.name}</span>
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
