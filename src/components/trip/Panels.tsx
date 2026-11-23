import { useEffect, useState, type FormEvent } from 'react'
import type { RecordData } from 'deepspace'
import { AlertTriangle, ArrowRight, Check, ExternalLink, Minus, Plus, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react'
import { Badge, Button, Input, Label, Modal, cn, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'
import { safeHref } from '@/lib/safeUrl'
import type { Activity, IssueRow, Member, Pref, Proposal, Stop } from './types'

type NameOf = (userId: string) => string

const ISSUE_LABEL: Record<string, string> = {
  overlap: 'Overlap',
  travel: 'Travel time',
  'outside-dates': 'Outside dates',
  overloaded: 'Too packed',
  'meal-gap': 'Meal gap',
  rain: 'Rain',
  budget: 'Budget',
  duplicate: 'Duplicate',
  'early-start': 'Early start',
}

export function IssuesPanel({ issues, onAskHive }: { issues: RecordData<IssueRow>[]; onAskHive: (prompt: string) => void }) {
  const sorted = [...issues].sort((a, b) => (a.data.date + a.data.severity).localeCompare(b.data.date + b.data.severity))
  if (sorted.length === 0)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <Check className="mx-auto mb-2 size-6 text-success" />
        Hive checked the plan: no conflicts.
      </div>
    )
  return (
    <div className="space-y-2 p-3">
      <Button size="sm" className="w-full" onClick={() => onAskHive('Fix the open plan issues with the smallest set of changes. Explain each proposal.')}>
        <Wand2 /> Ask Hive to fix these
      </Button>
      {sorted.map((i) => (
        <div
          key={i.recordId}
          data-testid="issue"
          className={cn('anim-in rounded-2xl border p-3.5 text-sm', i.data.severity === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5')}
        >
          <div className="mb-1 flex items-center gap-2 text-xs">
            <AlertTriangle className={cn('size-3.5', i.data.severity === 'error' ? 'text-destructive' : 'text-warning')} />
            <span className="font-semibold">{ISSUE_LABEL[i.data.type] ?? i.data.type}</span>
            <span className="text-muted-foreground">{i.data.date}</span>
          </div>
          <p>{i.data.message}</p>
        </div>
      ))}
    </div>
  )
}

function describeChange(p: Proposal, stops: Map<string, Stop>) {
  if (p.kind === 'add' && p.payload.stop) {
    const s = p.payload.stop
    return (
      <span>
        <Plus className="mr-1 inline size-3.5 text-success" />
        <b>{s.title}</b> · {s.date} {s.start ?? ''}
        {s.end ? `–${s.end}` : ''}
      </span>
    )
  }
  const target = p.payload.stopId ? stops.get(p.payload.stopId) : undefined
  if (p.kind === 'remove')
    return (
      <span>
        <Minus className="mr-1 inline size-3.5 text-destructive" />
        Remove <b>{target?.title ?? 'a stop'}</b>
      </span>
    )
  const patch = p.payload.patch ?? {}
  return (
    <span>
      <ArrowRight className="mr-1 inline size-3.5 text-info" />
      <b>{target?.title ?? 'stop'}</b>:{' '}
      {Object.entries(patch)
        .filter(([k]) => !['lat', 'lng'].includes(k))
        .map(([k, v]) => `${k} ${String((target as Record<string, unknown> | undefined)?.[k] ?? '—')} → ${String(v)}`)
        .join(', ')}
    </span>
  )
}

export function ProposalsPanel({
  proposals,
  stops,
  members,
  me,
  isOwner,
  nameOf,
}: {
  proposals: RecordData<Proposal>[]
  stops: RecordData<Stop>[]
  members: RecordData<Member>[]
  me: string
  isOwner: boolean
  nameOf: NameOf
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const stopMap = new Map(stops.map((s) => [s.recordId, s.data]))
  const pending = proposals.filter((p) => p.data.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const decided = proposals
    .filter((p) => p.data.status !== 'pending')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
  const n = members.length

  async function vote(id: string, value: 1 | -1, force = false) {
    setBusy(id)
    try {
      const r = await callAction<{ status: string }>('vote', { proposalId: id, value, force })
      if (r.status === 'accepted') toast.success('Applied to the plan')
      if (r.status === 'stale') toast.warning('That stop changed since — proposal marked stale')
    } catch (err) {
      toast.error('Vote failed', (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2 p-3">
      {pending.length === 0 && (
        <p className="p-4 text-center text-sm text-muted-foreground">No pending suggestions. Ask Hive for ideas — every change it suggests lands here for a vote.</p>
      )}
      {pending.map((p) => {
        const votes = p.data.votes ?? {}
        const yes = Object.values(votes).filter((v) => v === 1).length
        const no = Object.values(votes).filter((v) => v === -1).length
        const mine = votes[me]
        return (
          <div key={p.recordId} data-testid="proposal" className="anim-in rounded-2xl border border-border bg-background/60 p-3.5 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-semibold">{p.data.summary}</p>
              <Badge variant="outline" size="sm">
                {yes}/{Math.floor(n / 2) + 1} 👍
              </Badge>
            </div>
            <p className="text-xs">{describeChange(p.data, stopMap)}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{p.data.reason}</p>
            {p.data.sources?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {p.data.sources.filter((u) => safeHref(u)).map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="size-3" />
                    {new URL(u).hostname.replace(/^www\./, '')}
                  </a>
                ))}
              </div>
            )}
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              Asked by {nameOf(p.data.proposedFor)}
              {Object.keys(votes).length > 0 &&
                ` · ${Object.entries(votes)
                  .map(([uid, v]) => `${v === 1 ? '👍' : '👎'} ${nameOf(uid)}`)
                  .join(', ')}`}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, (yes / (Math.floor(n / 2) + 1)) * 100)}%` }} />
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant={mine === 1 ? 'default' : 'outline'} disabled={busy === p.recordId} onClick={() => vote(p.recordId, 1)}>
                <ThumbsUp /> Yes
              </Button>
              <Button size="sm" variant={mine === -1 ? 'secondary' : 'outline'} disabled={busy === p.recordId} onClick={() => vote(p.recordId, -1)}>
                <ThumbsDown /> No
              </Button>
              {isOwner && (
                <Button size="sm" variant="ghost" className="ml-auto" disabled={busy === p.recordId} onClick={() => vote(p.recordId, 1, true)}>
                  Approve now
                </Button>
              )}
            </div>
          </div>
        )
      })}
      {decided.length > 0 && (
        <div className="pt-2">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recently decided</p>
          {decided.map((p) => (
            <p key={p.recordId} className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
              <Badge size="sm" variant={p.data.status === 'accepted' ? 'success' : p.data.status === 'stale' ? 'warning' : 'secondary'}>
                {p.data.status}
              </Badge>
              <span className="truncate">{p.data.summary}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function ActivityFeed({ activity, nameOf }: { activity: RecordData<Activity>[]; nameOf: NameOf }) {
  const rows = [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
  return (
    <ul className="space-y-2 p-3 text-sm">
      {rows.map((a) => (
        <li key={a.recordId} className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <span>
            <b>{a.data.actorId === 'hive' ? 'Hive' : nameOf(a.data.actorId)}</b> {a.data.text}
            <span className="block text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
          </span>
        </li>
      ))}
      {rows.length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
    </ul>
  )
}

export function PrefsModal({
  open,
  onClose,
  existing,
  tripId,
  ready,
  onSave,
}: {
  open: boolean
  onClose: () => void
  existing: RecordData<Pref> | undefined
  tripId: string
  ready: boolean
  onSave: (data: Partial<Pref>, recordId?: string) => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<Partial<Pref>>({})
  useEffect(() => {
    if (open) setForm(existing?.data ?? { pace: 'balanced', wakeTime: '08:00' })
  }, [open, existing])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await onSave(
        {
          tripId,
          pace: form.pace,
          dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : undefined,
          interests: form.interests,
          dietary: form.dietary,
          wakeTime: form.wakeTime,
        },
        existing?.recordId,
      )
      onClose()
    } catch (err) {
      toast.error('Could not save', (err as Error).message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>My travel style</Modal.Title>
      </Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body className="space-y-3">
          <p className="text-sm text-muted-foreground">Everyone on the trip sees these. Hive plans for the whole group, and checks every day against the strictest settings.</p>
          <div className="space-y-1.5">
            <Label>Pace</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['chill', 'balanced', 'packed'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, pace: p })}
                  className={cn('rounded-lg border px-2 py-2 text-sm capitalize', form.pace === p ? 'border-primary bg-accent' : 'border-border')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="pref-budget">Daily budget ($)</Label>
              <Input id="pref-budget" type="number" min={0} value={form.dailyBudget ?? ''} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pref-wake">Usually up by</Label>
              <Input id="pref-wake" type="time" value={form.wakeTime ?? ''} onChange={(e) => setForm({ ...form, wakeTime: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-int">Interests</Label>
            <Input id="pref-int" placeholder="street food, museums, viewpoints" value={form.interests ?? ''} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-diet">Dietary needs</Label>
            <Input id="pref-diet" placeholder="vegetarian, no shellfish…" value={form.dietary ?? ''} onChange={(e) => setForm({ ...form, dietary: e.target.value })} />
          </div>
        </Modal.Body>
        <Modal.Footer className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready}>
            Save
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
