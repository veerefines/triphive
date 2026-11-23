import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { HiveNavState } from '@/components/AskHiveFab'
import { getUserColor, useAuth, useMutations, usePresenceRoom, useQuery, useUsers, type RecordData } from 'deepspace'
import { ArrowLeft, Bot, CloudSun, Copy, FileDown, LogOut, Mail, MapPin, SlidersHorizontal, Trash2, UserPlus, X } from 'lucide-react'
import { Button, ConfirmModal, cn, useToast } from '@/components/ui'
import { ChatPanel } from '@/components/ChatPanel'
import { ItineraryDay, StopModal, weekday } from '@/components/trip/Board'
import { ActivityFeed, IssuesPanel, PrefsModal, ProposalsPanel } from '@/components/trip/Panels'
import { RouteMap } from '@/components/trip/RouteMap'
import { TripChatContext } from '@/components/trip/PlaceCards'
import { TripBudget } from '@/components/trip/TripBudget'
import { ExplorePanel, GroupChat, VisibilityChip, VisibilityModal } from '@/components/trip/Social'
import type { Activity, IssueRow, Member, Pref, Proposal, Stop, Trip } from '@/components/trip/types'
import { callAction, downloadPlanPdf } from '@/lib/api'
import { tripDates } from '@/lib/planCheck'
import { useTripMoney } from '@/components/trip/useTripMoney'
import { PlaceSheet } from '@/components/trip/PlaceSheet'
import type { PeekStop } from '@/components/trip/MapPlacePeek'
import { BrandMark } from '@/components/ui/Brand'

type SideTab = 'hive' | 'chat' | 'proposals' | 'issues' | 'budget' | 'explore'

// Hive always runs on Groq (src/ai/llm.ts); the server ignores modelId.
const HIVE_TIP_KEY = 'triphive:hive-tip-hidden'
const HIVE_MODELS = [{ id: 'groq-llama-3.3', label: 'Hive · Llama 3.3 (Groq)', provider: 'groq' }]

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
  const { records: myProfiles } = useQuery<{ userId: string; homeCity?: string }>('profiles', { where: { userId: userId ?? '' } })
  const prefRows = useMemo(() => prefs.map((p) => p.data), [prefs])
  const [detailStop, setDetailStop] = useState<PeekStop | null>(null)
  const money = useTripMoney(trip?.data, prefRows, members.length, myProfiles[0]?.data.homeCity)

  const [side, setSide] = useState<SideTab>('hive')
  const [isHiveTipHidden, setHiveTipHidden] = useState(() => {
    try {
      return localStorage.getItem(HIVE_TIP_KEY) === '1'
    } catch {
      return false
    }
  })
  const hideHiveTip = () => {
    setHiveTipHidden(true)
    try {
      localStorage.setItem(HIVE_TIP_KEY, '1')
    } catch {
      // private mode: the tip just comes back next visit
    }
  }
  const [mapDate, setMapDate] = useState<string>('')
  const [editing, setEditing] = useState<{ stop: RecordData<Stop> | null; date: string } | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [visOpen, setVisOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'plan' | 'map' | 'hive'>('plan')
  // The global Ask Hive button navigates here with router state (never a URL
  // param, so a shared link cannot auto-send a prompt). Consume it once.
  const location = useLocation()
  const hiveNav = location.state as HiveNavState | null
  useEffect(() => {
    if (!hiveNav?.openHive) return
    setSide('hive')
    setMobileTab('hive')
    if (hiveNav.hivePrompt) setPendingPrompt(hiveNav.hivePrompt)
    navigate(location.pathname, { replace: true, state: null })
  }, [hiveNav, location.pathname, navigate])
  const focusStop = useCallback((id: string) => {
    setActiveStopId(id)
    setMobileTab('plan')
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

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

  // Plan check: re-run (server-side) shortly after THIS client changes the plan.
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

  if (status === 'loading')
    return (
      <div className="flex h-full flex-col gap-4 p-6" aria-busy="true" aria-label="Loading trip">
        <div className="skeleton h-10 w-72" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="w-full space-y-3 lg:w-[420px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
          <div className="skeleton hidden flex-1 rounded-3xl lg:block" />
          <div className="skeleton hidden w-[380px] rounded-3xl lg:block" />
        </div>
      </div>
    )
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

  const outside = [...new Set(stops.filter((s) => !dates.includes(s.data.date)).map((s) => s.data.date))].sort()
  const selectDay = (d: string) => {
    setMapDate(d)
    document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const mapIndex = dates.indexOf(mapDate)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pb-3 pt-5">
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
          <Link
            to="/trips"
            className="mt-1 flex size-10 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]"
            aria-label="All trips"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display line-clamp-2 text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 whitespace-nowrap font-mono text-[11px]">
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><MapPin className="size-3 text-honey" /> {t.destination}</span>
              <span className="rounded-full border border-border px-2.5 py-1">
                {weekday(t.startDate, { month: 'short', day: 'numeric' })} – {weekday(t.endDate, { month: 'short', day: 'numeric' })}
              </span>
              <span className="rounded-full border border-border px-2.5 py-1">
                {dates.length} day{dates.length === 1 ? '' : 's'} · {members.length} traveler{members.length === 1 ? '' : 's'}
              </span>
              <VisibilityChip visibility={t.visibility} isOwner={isOwner} onClick={() => setVisOpen(true)} />
              {issues.length > 0 && (
                <button type="button" onClick={() => setSide('issues')} className="rounded-full bg-warning/15 px-2.5 py-1 font-medium text-[#92560a]">
                  ⚠ {issues.length} plan issue{issues.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="flex items-center -space-x-2" aria-label="Travelers">
              {members.map((m) => {
                const u = users.find((x) => x.id === m.data.userId)
                const online = m.data.userId === userId || onlineIds.has(m.data.userId)
                const hasPrefs = prefs.some((p) => p.data.userId === m.data.userId)
                return (
                  <div
                    key={m.recordId}
                    title={`${nameOf(m.data.userId)}${m.data.role === 'owner' ? ' (organizer)' : ''}${online ? ' · online' : ''}${hasPrefs ? '' : ' · no preferences yet'}`}
                    className={cn('relative size-9 rounded-full border-2 border-background text-xs font-semibold text-white', !online && 'opacity-60')}
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
              className="flex items-center gap-2 rounded-full bg-honey-soft px-3.5 py-2 text-sm font-medium text-[#7a3412] transition hover:brightness-95"
              data-testid="invite-code"
              title="Copy invite code"
            >
              <UserPlus className="size-4" />
              <span className="font-mono tracking-[0.18em]">{t.inviteCode}</span>
              <Copy className="size-3.5 opacity-70" />
            </button>
          </div>

          <div className="scrollbar-none -mx-6 flex w-[calc(100%+3rem)] gap-2 overflow-x-auto px-6 xl:mx-0 xl:ml-auto xl:w-auto xl:overflow-visible xl:px-0 [&>*]:shrink-0">
            <Button size="sm" variant={myPrefs ? 'outline' : 'default'} onClick={() => setPrefsOpen(true)}>
              <SlidersHorizontal /> {myPrefs ? 'My style' : 'Set my style'}
            </Button>
            <Button size="sm" variant="outline" loading={busy === 'Weather'} onClick={() => run('Weather', () => callAction('refreshWeather', { tripId }), 'Forecast updated')}>
              <CloudSun /> Weather
            </Button>
            <Button size="sm" variant="outline" loading={busy === 'Email'} onClick={() => run('Email', () => callAction('emailItinerary', { tripId }), 'Itinerary emailed to the group')}>
              <Mail /> Email plan
            </Button>
            <Button size="sm" variant="outline" loading={busy === 'PDF'} onClick={() => run('PDF', () => downloadPlanPdf(tripId), 'PDF downloaded')}>
              <FileDown /> Download PDF
            </Button>
            {isOwner ? (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete trip
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
                <LogOut /> Leave trip
              </Button>
            )}
          </div>
        </div>

        {/* Day chips */}
        <div className="scrollbar-none -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
          {dates.map((d, i) => {
            const fc = t.forecast?.[d]
            return (
              <button
                key={d}
                type="button"
                onClick={() => selectDay(d)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                  mapDate === d ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40',
                )}
              >
                Day {i + 1}
                <span className={cn('font-mono text-[11px]', mapDate === d ? 'opacity-70' : 'text-muted-foreground')}>{weekday(d, { weekday: 'short', day: 'numeric' })}</span>
                {fc && <span className="text-xs">{fc.rain ? '🌧' : '☀️'}</span>}
              </button>
            )
          })}
        </div>
      </header>

      <div className="px-6 pb-3 lg:hidden">
        <div className="grid grid-cols-3 rounded-full border border-border bg-card p-1 text-sm font-medium" role="tablist" aria-label="View">
          {(
            [
              ['plan', 'Itinerary'],
              ['map', 'Map'],
              ['hive', `Hive${pendingCount ? ` · ${pendingCount}` : ''}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mobileTab === k}
              onClick={() => setMobileTab(k)}
              className={cn('rounded-full py-1.5 transition', mobileTab === k ? 'bg-foreground text-background' : 'text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 lg:flex-row">
        {/* Itinerary */}
        <section
          className={cn('scrollbar-none min-h-0 w-full shrink-0 space-y-8 overflow-y-auto lg:block lg:w-[420px]', mobileTab !== 'plan' && 'hidden')}
          aria-label="Itinerary"
        >
          {dates.map((d, i) => (
            <ItineraryDay
              key={d}
              date={d}
              index={i}
              trip={t}
              stops={stops.filter((s) => s.data.date === d)}
              issues={issues}
              peers={peers}
              canWrite={stopMut.ready}
              selected={mapDate === d}
              onSelect={() => setMapDate(d)}
              activeStopId={activeStopId}
              onHoverStop={setActiveStopId}
              onAdd={(date) => setEditing({ stop: null, date })}
              onEdit={(stop) => setEditing({ stop, date: stop.data.date })}
              onDetails={(stop) => setDetailStop({ ...stop.data, id: stop.recordId })}
            />
          ))}
          {outside.map((d) => (
            <ItineraryDay
              key={d}
              date={d}
              index={null}
              trip={t}
              stops={stops.filter((s) => s.data.date === d)}
              issues={issues}
              peers={peers}
              canWrite={stopMut.ready}
              selected={false}
              onSelect={() => undefined}
              onAdd={() => undefined}
              onEdit={(stop) => setEditing({ stop, date: stop.data.date })}
            />
          ))}
        </section>

        {detailStop && trip && <PlaceSheet stop={detailStop} destination={trip.data.destination} money={money} onClose={() => setDetailStop(null)} />}
        {/* Map */}
        <section className={cn('min-h-[60vh] min-w-0 flex-1 lg:block lg:min-h-0', mobileTab !== 'map' && 'hidden')} aria-label="Map">
          {mapDate && (
            <RouteMap
              trip={t}
              stops={stops}
              date={mapDate}
              label={`Day ${mapIndex + 1} · ${weekday(mapDate, { weekday: 'long', month: 'short', day: 'numeric' })}`}
              activeStopId={activeStopId}
              onPinClick={focusStop}
              onPinHover={setActiveStopId}
              money={money}
            />
          )}
        </section>

        {/* Side panel */}
        <aside
          className={cn(
            'min-h-[520px] w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] lg:flex lg:w-[380px]',
            mobileTab === 'hive' ? 'flex' : 'hidden',
          )}
        >
          <div className="flex gap-1 border-b border-border p-1.5 text-sm">
            {(
              [
                ['hive', 'Hive', null],
                ['chat', 'Chat', null],
                ['proposals', 'Votes', pendingCount],
                ['issues', 'Issues', issues.length],
                ['budget', 'Cost', null],
                ['explore', 'Explore', null],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSide(key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-[13px] transition',
                  side === key ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {key === 'hive' && <Bot className="size-4" />}
                {label}
                {!!count && (
                  <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', side === key ? 'bg-background/20' : 'bg-honey text-white')}>{count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={cn('h-full', side !== 'hive' && 'hidden')}>
              {userId && (
                <TripChatContext.Provider
                  value={{ tripId, dates, labelFor: (d) => `Day ${dates.indexOf(d) + 1} · ${weekday(d, { weekday: 'short', month: 'short', day: 'numeric' })}` }}
                >
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
                    isHiveTipHidden ? undefined : (
                      <div className="mx-3 my-3 flex items-start gap-3 rounded-2xl bg-honey-soft p-3 text-xs text-[#7a3412]">
                        <BrandMark size={22} />
                        <p className="flex-1">
                          <b>Hive</b> researches places, checks weather & routes, and <b>suggests</b> changes. The group votes before anything lands.
                        </p>
                        <button type="button" onClick={hideHiveTip} aria-label="Dismiss tip" className="-m-1 rounded-full p-1 hover:bg-black/5">
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    )
                  }
                />
                </TripChatContext.Provider>
              )}
            </div>
            {side === 'proposals' && <ProposalsPanel proposals={proposals} stops={stops} members={members} me={userId ?? ''} isOwner={isOwner} nameOf={nameOf} />}
            {side === 'issues' && (
              <IssuesPanel
                issues={issues}
                onAskHive={(p) => {
                  setPendingPrompt(p)
                  setSide('hive')
                  setMobileTab('hive')
                }}
              />
            )}
            {side === 'chat' && <GroupChat tripId={tripId} destination={trip.data.destination} me={userId ?? ''} nameOf={nameOf} dates={dates} labelFor={(d) => `Day ${dates.indexOf(d) + 1} · ${weekday(d, { weekday: 'short', month: 'short', day: 'numeric' })}`} money={money} />}
            {side === 'budget' && <TripBudget trip={t} stops={stops} dates={dates} money={money} homeCity={myProfiles[0]?.data.homeCity} />}
            {side === 'explore' && (
              <>
                <ExplorePanel
                  tripId={tripId}
                  trip={t}
                  date={mapDate || dates[0]}
                  dateLabel={`Day ${Math.max(1, dates.indexOf(mapDate) + 1)}`}
                />
                <div className="border-t border-border">
                  <p className="px-4 pt-4 font-display text-lg font-semibold">Activity</p>
                  <ActivityFeed activity={activity} nameOf={nameOf} />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {isOwner && <VisibilityModal open={visOpen} onClose={() => setVisOpen(false)} tripId={tripId} trip={t} />}
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
        title={isOwner ? 'Delete this trip?' : 'Leave this trip?'}
        description={
          isOwner
            ? 'This removes every stop, vote and preference for all travelers. It cannot be undone.'
            : 'You will lose access until someone shares the invite code again.'
        }
        confirmText={isOwner ? 'Delete trip' : 'Leave trip'}
        variant="destructive"
        onConfirm={() =>
          run(isOwner ? 'Delete' : 'Leave', async () => {
            await callAction(isOwner ? 'deleteTrip' : 'leaveTrip', { tripId })
            navigate('/trips')
          })
        }
      />
    </div>
  )
}
