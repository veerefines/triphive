/**
 * Social pieces of the trip page: Private/Public publishing, group chat,
 * and the Explore tab (travelers nearby ±5 days + TripHive Featured).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Globe2, Lock, Send } from 'lucide-react'
import { Button, Label, Modal, Textarea, cn, useToast } from '@/components/ui'
import { FeaturedCard, PersonAvatar, PublicTripCard, VIBES, VIBE_EMOJI, type Listing } from '@/components/social'
import { featuredNear } from '@/data/featured'
import { callAction } from '@/lib/api'
import { matchLabel, matchTrips } from '@/lib/match'
import { getAuthToken } from 'deepspace'
import type { PlaceCard } from '@/ai/hive-group'
import { HiveCard } from './HiveCard'
import type { TripMoney } from './useTripMoney'
import type { Trip } from './types'
import { HiveAvatar } from '@/components/ui/Brand'

export function VisibilityChip({ visibility, isOwner, onClick }: { visibility?: string; isOwner: boolean; onClick: () => void }) {
  const pub = visibility === 'public'
  return (
    <button
      type="button"
      data-testid="visibility"
      disabled={!isOwner}
      onClick={onClick}
      title={isOwner ? 'Change who can find this trip' : pub ? 'Listed on Discover' : 'Invite-only'}
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition',
        pub ? 'bg-success/15 text-success' : 'border border-border text-muted-foreground',
        isOwner && 'hover:brightness-95',
      )}
    >
      {pub ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
      {pub ? 'Public' : 'Private'}
    </button>
  )
}

export function VisibilityModal({ open, onClose, tripId, trip }: { open: boolean; onClose: () => void; tripId: string; trip: Trip & { visibility?: string } }) {
  const toast = useToast()
  const { records } = useQuery<Listing>('public_trips', { where: { tripId } })
  const listing = records[0]?.data
  const [pub, setPub] = useState(trip.visibility === 'public')
  const [description, setDescription] = useState('')
  const [vibes, setVibes] = useState<string[]>([])
  const [spots, setSpots] = useState(2)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPub(trip.visibility === 'public')
    setDescription(listing?.description ?? '')
    setVibes(listing?.vibes ?? [])
    setSpots(Number(listing?.openSpots ?? 2))
  }, [open, trip.visibility, listing])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await callAction('setVisibility', { tripId, visibility: pub ? 'public' : 'private', description, vibes, openSpots: spots })
      toast.success(pub ? 'Trip is public on Discover' : 'Trip is private again')
      onClose()
    } catch (err) {
      toast.error('Could not update', (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Who can find this trip?</Modal.Title>
      </Modal.Header>
      <form onSubmit={save}>
        <Modal.Body className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: false, icon: '🔒', t: 'Private', d: 'Invite code only' },
              { v: true, icon: '🌍', t: 'Public', d: 'Listed on Discover; travelers can ask to join' },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                aria-pressed={pub === o.v}
                onClick={() => setPub(o.v)}
                className={cn('rounded-2xl border p-4 text-left transition', pub === o.v ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40')}
              >
                <span className="text-2xl">{o.icon}</span>
                <p className="mt-1 font-semibold">{o.t}</p>
                <p className={cn('text-xs', pub === o.v ? 'text-background/70' : 'text-muted-foreground')}>{o.d}</p>
              </button>
            ))}
          </div>
          {pub && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pub-desc">Pitch your trip</Label>
                <Textarea id="pub-desc" rows={3} maxLength={500} placeholder="Three friends doing food markets and sunsets. Looking for 1–2 easy-going people!" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Vibe (up to 5)</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VIBES.map((v) => {
                    const on = vibes.includes(v)
                    return (
                      <button key={v} type="button" aria-pressed={on} onClick={() => setVibes(on ? vibes.filter((x) => x !== v) : [...vibes, v].slice(0, 5))} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-[var(--color-honey)] bg-[var(--color-honey-soft)]' : 'border-border')}>
                        {VIBE_EMOJI[v]} {v}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Open spots</p>
                  <p className="text-xs text-muted-foreground">How many new people can join</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Fewer spots" onClick={() => setSpots(Math.max(0, spots - 1))} className="size-8 rounded-full border border-border bg-card">−</button>
                  <span className="w-6 text-center font-mono font-semibold" data-testid="spots">{spots}</span>
                  <button type="button" aria-label="More spots" onClick={() => setSpots(Math.min(20, spots + 1))} className="size-8 rounded-full border border-border bg-card">+</button>
                </div>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">Strangers see the title, dates, your pitch and day highlights — never the invite code or full plan.</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{pub ? 'Publish' : 'Save'}</Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

type TripMsg = { tripId: string; senderId: string; text: string; cards?: PlaceCard[] }

const HIVE = 'hive'
const HIVE_WAIT_MS = 45_000

interface GroupChatProps {
  tripId: string
  destination: string
  me: string
  nameOf: (uid: string) => string
  dates: string[]
  labelFor: (date: string) => string
  money: TripMoney
}

/** Ask Hive to read the chat. It replies into trip_messages, so the live query shows it. */
async function pingHive(tripId: string): Promise<{ accepted?: boolean; error?: string }> {
  const token = await getAuthToken()
  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/hive-chat`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  const body = (await res.json().catch(() => ({}))) as { accepted?: boolean; error?: string }
  return res.ok ? body : { error: body.error ?? `Hive unavailable (${res.status})` }
}

export function GroupChat({ tripId, destination, me, nameOf, dates, labelFor, money }: GroupChatProps) {
  const toast = useToast()
  const { records } = useQuery<TripMsg>('trip_messages', { where: { tripId } })
  const [text, setText] = useState('')
  const [hiveSince, setHiveSince] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const msgs = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const lastHiveAt = [...msgs].reverse().find((m) => m.data.senderId === HIVE)?.createdAt
  const isHiveThinking = !!hiveSince && !(lastHiveAt && lastHiveAt > hiveSince)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, isHiveThinking])
  useEffect(() => {
    if (!hiveSince) return
    // Hive answers NOOP silently; stop the indicator after a while.
    const t = setTimeout(() => setHiveSince(null), HIVE_WAIT_MS)
    return () => clearTimeout(t)
  }, [hiveSince])

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      await callAction('sendTripMessage', { tripId, text: body })
      const since = new Date().toISOString()
      pingHive(tripId)
        .then((r) => {
          if (r.accepted) setHiveSince(since)
          else if (r.error) toast.error('Hive is resting', r.error)
        })
        .catch(() => undefined)
    } catch (err) {
      setText(body)
      toast.error('Not sent', (err as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-3xl">💬</p>
            <p className="mt-1 font-semibold">Group chat</p>
            <p className="text-sm text-muted-foreground">Say hi to everyone on the trip. Hive listens in: agree on a place and it lands in the plan.</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const isHive = m.data.senderId === HIVE
          const mine = m.data.senderId === me
          const showName = !mine && msgs[i - 1]?.data.senderId !== m.data.senderId
          const avatar = isHive ? (
            <HiveAvatar className={cn(!showName && 'invisible')} />
          ) : (
            <PersonAvatar uid={m.data.senderId} size={26} className={showName ? '' : 'invisible'} />
          )
          return (
            <div key={m.recordId} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
              {!mine && avatar}
              <div className="max-w-[78%]">
                {showName && <p className="mb-0.5 ml-1 text-[11px] text-muted-foreground">{isHive ? 'Hive' : nameOf(m.data.senderId)}</p>}
                <p data-testid="group-msg" className={cn('whitespace-pre-wrap rounded-3xl px-3.5 py-2 text-sm', mine ? 'rounded-br-md bg-foreground text-background' : isHive ? 'rounded-bl-md bg-honey/15' : 'rounded-bl-md bg-muted')}>
                  {m.data.text}
                </p>
                {isHive && (m.data.cards ?? []).map((c) => <HiveCard key={c.name} card={c} tripId={tripId} destination={destination} dates={dates} labelFor={labelFor} money={money} />)}
              </div>
            </div>
          )
        })}
        {isHiveThinking && (
          <p data-testid="hive-thinking" className="anim-in flex items-center gap-2 pl-1 text-xs text-muted-foreground">
            <HiveAvatar />
            <span className="animate-pulse">Hive is reading the chat…</span>
          </p>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-2.5">
        <input aria-label="Message the group" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Message the group…" className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-foreground/40" />
        <button type="submit" aria-label="Send" disabled={!text.trim()} className="flex size-10 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}

export function ExplorePanel({ tripId, trip, date, dateLabel }: { tripId: string; trip: Trip; date: string; dateLabel: string }) {
  const toast = useToast()
  const { records } = useQuery<Listing>('public_trips', {})
  const [done, setDone] = useState<Set<string>>(new Set())
  const matches = matchTrips({ ...trip, id: tripId }, records.map((r) => ({ ...r.data, id: r.data.tripId })))
  const featured = featuredNear(trip)

  async function suggest(f: (typeof featured)[number]) {
    try {
      await callAction('suggestStop', {
        tripId,
        stop: { title: f.name, date, category: f.category, lat: f.lat, lng: f.lng, notes: `TripHive Featured · ${f.perk}. ${f.blurb}`, costPerPerson: f.priceFrom },
        reason: `TripHive Verified by ${f.verifiedBy} · perk: ${f.perk}`,
      })
      setDone((s) => new Set(s).add(f.id))
      toast.success('Suggested to the group', 'It’s in Votes now')
    } catch (err) {
      toast.error('Could not suggest', (err as Error).message)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <h3 className="font-display text-lg font-semibold">Travelers nearby</h3>
        <p className="font-mono text-[11px] text-muted-foreground">Public trips in {trip.destination.split(',')[0]} within ±5 days</p>
        {matches.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
            {trip.visibility === 'public' ? (
              <>No other public trips here yet. Your trip is listed on Discover, so travelers heading this way can find you.</>
            ) : (
              <>Nobody else yet. Make your trip <b>Public</b> so solo travelers heading here can find you.</>
            )}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {matches.slice(0, 4).map((m) => (
              <PublicTripCard key={m.trip.tripId} listing={m.trip} badge={matchLabel(m)} action={<Link to={`/discover/${m.trip.tripId}`} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background">View</Link>} />
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold">TripHive Featured</h3>
        <p className="font-mono text-[11px] text-muted-foreground">Verified spots with member perks · suggest to {dateLabel}</p>
        {featured.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No verified spots here yet.</p>
        ) : (
          <div className="scrollbar-none -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((f) => (
              <FeaturedCard
                key={f.id}
                place={f}
                compact
                action={
                  <button
                    type="button"
                    disabled={done.has(f.id)}
                    onClick={() => suggest(f)}
                    className="w-full rounded-full bg-foreground py-2 text-xs font-semibold text-background disabled:bg-success/15 disabled:text-success"
                  >
                    {done.has(f.id) ? 'Suggested ✓' : 'Suggest to group'}
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
