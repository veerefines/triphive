import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getUserColor, listDeepSpaceAgentModels, useAuth, useMutations, usePresenceRoom, useQuery, useUsers, type RecordData } from 'deepspace'
import { ArrowLeft, Bot, CloudSun, Copy, Mail, Map as MapIcon, SlidersHorizontal, Trash2, Users } from 'lucide-react'
import { Badge, Button, ConfirmModal, cn, useToast } from '@/components/ui'
import { ChatPanel } from '@/components/ChatPanel'
import { DayColumn, StopModal } from '@/components/trip/Board'
import { ActivityFeed, IssuesPanel, PrefsModal, ProposalsPanel } from '@/components/trip/Panels'
import { RouteMap } from '@/components/trip/RouteMap'
import type { Activity, IssueRow, Member, Pref, Proposal, Stop, Trip } from '@/components/trip/types'
import { callAction } from '@/lib/api'
import { tripDates } from '@/lib/planCheck'

type SideTab = 'hive' | 'proposals' | 'issues' | 'activity'

// Mirrors HIVE_MODELS in src/ai/chat-routes.ts (the server enforces it).
const HIVE_MODEL_IDS = ['claude-sonnet-5-5', 'claude-haiku-5-5']
const HIVE_MODELS = listDeepSpaceAgentModels('application')
  .filter((m) => HIVE_MODEL_IDS.includes(m.id))
  .sort((a, b) => HIVE_MODEL_IDS.indexOf(a.id) - HIVE_MODEL_IDS.indexOf(b.id))
  .map((m) => ({ id: m.id, label: m.label, provider: m.providerLabel }))

const HIVE_PROMPTS = [
  'Plan our first day around everyone’s preferences',
  'Check the plan for conflicts and fix them',
  'Find a great dinner spot near our last stop each day',
  'What should we do if it rains?',
]

export default function TripPage() {
  const { id: tripId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { userId } = useAuth()
  const { users } = useUsers()

  const { records: tripRows, status } = useQuery<Trip>('trips', { where: { teamId: tripId } })
  const trip = tripRows[0]
  const { records: stops } = useQuery<Stop>('stops', { where: { tripId } })
  const { records: members } = useQuery<Member>('team_members', { where: { teamId: tripId } })
  const { records: prefs } = useQuery<Pref>('prefs', { where: { tripId } })
  const { records: issues } = useQuery<IssueRow>('issues', { where: { tripId } })
  const { records: proposals } = useQuery<Proposal>('proposals', { where: { tripId } })
  const { records: activity } = useQuery<Activity>('activity', { where: { tripId } })
  const stopMut = useMutations<Stop>('stops')
  const { peers, updateState } = usePresenceRoom(`trip:${tripId}`)

  const [side, setSide] = useState<SideTab>('hive')
  const [view, setView] = useState<'board' | 'map'>('board')
  const [mapDate, setMapDate] = useState<string>('')
  const [editing, setEditing] = useState<{ stop: RecordData<Stop> | null; date: string } | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // One persistent Hive chat per user per trip (ai-chats are private, `'own'`).
  const chatKey = `triphive:chat:${tripId}`
  const [chatId, setChatId] = useState<string | null>(() => (typeof localStorage !== 'undefined' ? localStorage.getItem(chatKey) : null))

  const dates = useMemo(() => (trip ? tripDates(trip.data.startDate, trip.data.endDate) : []), [trip])
  useEffect(() => {
    if (dates.length && !dates.includes(mapDate)) setMapDate(dates[0])
  }, [dates, mapDate])

  const nameOf = useCallback(
    (uid: string) => (uid === userId ? 'You' : users.find((u) => u.id === uid)?.name ?? 'Traveler'),
    [users, userId],
  )
  const me = members.find((m) => m.data.userId === userId)
  const isOwner = me?.data.role === 'owner'
  const myPrefs = prefs.find((p) => p.data.userId === userId)
  const onlineIds = new Set(peers.map((p) => p.userId))
  const pendingCount = proposals.filter((p) => p.data.status === 'pending').length

  // Plan Doctor: re-run (server-side) shortly after THIS client changes the plan.
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRecheck = useCallback(() => {
    if (recheckTimer.current) clearTimeout(recheckTimer.current)
    recheckTimer.current = setTimeout(() => {
      callAction('runPlanCheck', { tripId }).catch(() => undefined)
    }, 1200)
  }, [tripId])

  // Presence: tell others which stop I'm editing.
  useEffect(() => {
    updateState({ editingStopId: editing?.stop?.recordId ?? null })
  }, [editing, updateState])

  if (status === 'loading') return <div className="p-10 text-muted-foreground">Loading trip…</div>
  if (!trip)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="font-display text-2xl">Trip not found</p>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or you are not a member. Ask for an invite code.</p>
        <Link to="/trips" className="mt-4 inline-block text-primary underline">
          Back to trips
        </Link>
      </div>
    )

  const t = trip.data

  async function run(label: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(label)
    try {
      await fn()
      if (ok) toast.success(ok)
    } catch (err) {
      toast.error(`${label} failed`, (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function saveStop(data: Partial<Stop>) {
    // Edits are direct realtime writes ('team' RBAC); creation goes through a
    // membership-checked action because RBAC `create` cannot be row-scoped.
    if (editing?.stop) await stopMut.put(editing.stop.recordId, data)
    else await callAction('addStop', { tripId, stop: data })
    scheduleRecheck()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-border bg-[var(--color-shell)] px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/trips" className="text-muted-foreground hover:text-foreground" aria-label="All trips">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display truncate text-2xl font-bold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t.destination} · {t.startDate} → {t.endDate} · {dates.length} day{dates.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center -space-x-2" aria-label="Travelers">
            {members.map((m) => {
              const u = users.find((x) => x.id === m.data.userId)
              const online = m.data.userId === userId || onlineIds.has(m.data.userId)
              const hasPrefs = prefs.some((p) => p.data.userId === m.data.userId)
              return (
                <div
                  key={m.recordId}
                  title={`${nameOf(m.data.userId)}${m.data.role === 'owner' ? ' (organizer)' : ''}${online ? ' · online' : ''}${hasPrefs ? '' : ' · no preferences yet'}`}
                  className={cn('relative size-9 rounded-full border-2 border-background text-xs font-semibold text-white', !online && 'opacity-50')}
                  style={{ background: getUserColor(m.data.userId) }}
                >
                  {u?.imageUrl ? (
                    <img src={u.imageUrl} alt="" className="size-full rounded-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center">{(u?.name ?? '?').slice(0, 1).toUpperCase()}</span>
                  )}
                  {online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-success" />}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(t.inviteCode)
              toast.success('Invite code copied', `Friends join at /trips with ${t.inviteCode}`)
            }}
            className="flex items-center gap-2 rounded-full border border-dashed border-primary/60 px-3 py-1.5 font-mono text-sm tracking-[0.2em] text-primary hover:bg-accent"
            data-testid="invite-code"
          >
            <Users className="size-4" /> {t.inviteCode} <Copy className="size-3.5" />
          </button>

          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant={myPrefs ? 'outline' : 'default'} onClick={() => setPrefsOpen(true)}>
              <SlidersHorizontal /> {myPrefs ? 'My style' : 'Set my style'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={busy === 'Weather'}
              onClick={() => run('Weather', () => callAction('refreshWeather', { tripId }), 'Forecast updated')}
            >
              <CloudSun /> Weather
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={busy === 'Email'}
              onClick={() => run('Email', () => callAction('emailItinerary', { tripId }), 'Itinerary emailed to the group')}
            >
              <Mail /> Email plan
            </Button>
            {isOwner && (
              <Button size="sm" variant="ghost" aria-label="Delete trip" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Main: board or map */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-6 pt-4">
            <div className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
              {(['board', 'map'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 capitalize', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                >
                  {v === 'map' && <MapIcon className="size-3.5" />}
                  {v}
                </button>
              ))}
            </div>
            {view === 'map' && (
              <select className="h-8 rounded-full border border-input bg-card px-3 text-sm" value={mapDate} onChange={(e) => setMapDate(e.target.value)} aria-label="Day">
                {dates.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            )}
            {issues.length > 0 && (
              <button type="button" onClick={() => setSide('issues')} className="ml-auto">
                <Badge variant="warning">{issues.length} plan issue{issues.length === 1 ? '' : 's'}</Badge>
              </button>
            )}
          </div>

          {view === 'board' ? (
            <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-6">
              {dates.map((d) => (
                <DayColumn
                  key={d}
                  date={d}
                  trip={t}
                  stops={stops.filter((s) => s.data.date === d)}
                  issues={issues}
                  peers={peers}
                  canWrite={stopMut.ready}
                  onAdd={(date) => setEditing({ stop: null, date })}
                  onEdit={(stop) => setEditing({ stop, date: stop.data.date })}
                />
              ))}
              {stops.some((s) => !dates.includes(s.data.date)) && (
                <DayColumn
                  date={stops.find((s) => !dates.includes(s.data.date))!.data.date}
                  trip={t}
                  stops={stops.filter((s) => !dates.includes(s.data.date))}
                  issues={issues}
                  peers={peers}
                  canWrite={stopMut.ready}
                  onAdd={() => undefined}
                  onEdit={(stop) => setEditing({ stop, date: stop.data.date })}
                />
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-6">{mapDate && <RouteMap trip={t} stops={stops} date={mapDate} />}</div>
          )}
        </section>

        {/* Side panel */}
        <aside className="flex min-h-[480px] w-full shrink-0 flex-col border-t border-border bg-card lg:w-[400px] lg:border-l lg:border-t-0">
          <div className="flex border-b border-border text-sm">
            {(
              [
                ['hive', 'Hive', null],
                ['proposals', 'Votes', pendingCount],
                ['issues', 'Issues', issues.length],
                ['activity', 'Activity', null],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSide(key)}
                className={cn('flex flex-1 items-center justify-center gap-1.5 py-3', side === key ? 'border-b-2 border-primary font-semibold text-foreground' : 'text-muted-foreground')}
              >
                {key === 'hive' && <Bot className="size-4" />}
                {label}
                {!!count && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{count}</span>}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={cn('h-full', side !== 'hive' && 'hidden')}>
              {userId && (
                <ChatPanel
                  key={tripId}
                  chatId={chatId}
                  userId={userId}
                  tripId={tripId}
                  models={HIVE_MODELS}
                  compact
                  className="h-full"
                  emptyStatePrompts={HIVE_PROMPTS}
                  pendingPrompt={side === 'hive' ? pendingPrompt : null}
                  onPendingPromptSent={() => setPendingPrompt(null)}
                  onChatCreated={(id) => {
                    setChatId(id)
                    localStorage.setItem(chatKey, id)
                  }}
                  header={
                    <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                      Hive researches places, checks weather & routes, and <b>suggests</b> changes — the group votes before anything lands.
                    </p>
                  }
                />
              )}
            </div>
            {side === 'proposals' && (
              <ProposalsPanel proposals={proposals} stops={stops} members={members} me={userId ?? ''} isOwner={isOwner} nameOf={nameOf} />
            )}
            {side === 'issues' && (
              <IssuesPanel
                issues={issues}
                onAskHive={(p) => {
                  setPendingPrompt(p)
                  setSide('hive')
                }}
              />
            )}
            {side === 'activity' && <ActivityFeed activity={activity} nameOf={nameOf} />}
          </div>
        </aside>
      </div>

      <StopModal
        open={!!editing}
        tripId={tripId}
        dates={dates}
        stopId={editing?.stop?.recordId ?? null}
        initial={editing?.stop ? editing.stop.data : { date: editing?.date ?? dates[0] }}
        ready={stopMut.ready}
        onClose={() => setEditing(null)}
        onSave={saveStop}
        onDelete={async () => {
          if (editing?.stop) {
            await stopMut.remove(editing.stop.recordId)
            scheduleRecheck()
          }
        }}
      />
      <PrefsModal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        existing={myPrefs}
        tripId={tripId}
        ready
        onSave={async (data) => {
          await callAction('savePrefs', { tripId, prefs: data })
        }}
      />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this trip?"
        description="This removes every stop, vote and preference for all travelers. It cannot be undone."
        confirmText="Delete trip"
        variant="destructive"
        onConfirm={() =>
          run('Delete', async () => {
            await callAction('deleteTrip', { tripId })
            navigate('/trips')
          })
        }
      />
    </div>
  )
}
