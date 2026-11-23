/**
 * Inbox: join requests as chat threads. The organizer gets an Accept /
 * Decline bar pinned above the composer; the requester's composer stays
 * locked until the request is accepted. Threads are readable only by the two
 * participants (collaborator RBAC on join_requests / dm_messages).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowLeft, Check, Lock, MapPin, MessagesSquare, Send, X } from 'lucide-react'
import { cn, useToast } from '@/components/ui'
import { PersonAvatar, fmtDate, usePeople, type JoinRequest } from '@/components/social'
import { callAction } from '@/lib/api'
import { BrandMark } from '@/components/ui/Brand'

type Dm = { requestId: string; senderId: string; text: string }

export default function InboxPage() {
  const { userId } = useAuth()
  const { person } = usePeople()
  const { records: threads, status } = useQuery<JoinRequest>('join_requests', {})
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'all' | 'requests'>('all')
  const selectedId = params.get('t')

  const sorted = useMemo(
    () => [...threads].sort((a, b) => (b.data.lastMessageAt ?? b.createdAt).localeCompare(a.data.lastMessageAt ?? a.createdAt)),
    [threads],
  )
  const incoming = sorted.filter((t) => t.data.ownerId === userId && t.data.status === 'pending')
  const list = tab === 'requests' ? incoming : sorted
  const selected = sorted.find((t) => t.recordId === selectedId)

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-6xl gap-4 px-4 py-4 sm:px-6">
      <aside className={cn('flex w-full flex-col overflow-hidden rounded-3xl border border-border bg-card md:w-[340px] md:shrink-0', selected && 'hidden md:flex')}>
        <div className="border-b border-border p-4">
          <h1 className="font-display text-3xl font-bold">Inbox</h1>
          <div className="mt-3 flex gap-1 rounded-full bg-muted p-1 text-xs font-medium">
            {(['all', 'requests'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn('flex-1 rounded-full px-3 py-1.5 transition', tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}
              >
                {k === 'all' ? 'All chats' : 'Requests'}
                {k === 'requests' && incoming.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--color-honey)] px-1.5 py-0.5 text-[10px] text-white">{incoming.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {status === 'loading' && [0, 1, 2].map((i) => <div key={i} className="skeleton m-2 h-16" />)}
          {status === 'ready' && list.length === 0 && (
            <div className="p-8 text-center">
              <span className="hex-badge mx-auto flex size-14 items-center justify-center bg-honey/30 text-[#7a3412]"><MessagesSquare className="size-6" aria-hidden="true" /></span>
              <p className="mt-2 font-semibold">{tab === 'requests' ? 'No pending requests' : 'No conversations yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask to join a trip on Discover, or make one of yours public.</p>
              <Link to="/discover" className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">Discover trips</Link>
            </div>
          )}
          {list.map((t) => {
            const other = t.data.ownerId === userId ? t.data.requesterId : t.data.ownerId
            const p = person(other)
            const incomingReq = t.data.ownerId === userId && t.data.status === 'pending'
            return (
              <button
                key={t.recordId}
                type="button"
                data-testid="thread"
                onClick={() => setParams({ t: t.recordId })}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition',
                  selectedId === t.recordId ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <span className="relative">
                  <PersonAvatar uid={other} size={44} />
                  {incomingReq && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-card bg-[var(--color-honey)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    <StatusPill status={t.data.status} />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {incomingReq ? 'wants to join ' : t.data.ownerId === userId ? '' : 'You asked to join '}
                    <b className="font-medium text-foreground/80">{t.data.tripTitle}</b>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className={cn('min-w-0 flex-1 overflow-hidden rounded-3xl border border-border bg-card', !selected && 'hidden md:block')}>
        {selected ? (
          <Thread key={selected.recordId} thread={selected} me={userId ?? ''} onBack={() => setParams({})} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-10 text-center">
            <BrandMark size={64} />
            <p className="font-display mt-3 text-2xl font-semibold">Pick a conversation</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Requests to join your public trips land here. Accept to unlock chat and share the plan.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: JoinRequest['status'] }) {
  const map = {
    pending: 'bg-[var(--color-honey-soft)] text-[#9a3f12]',
    accepted: 'bg-success/15 text-success',
    declined: 'bg-muted text-muted-foreground',
  }
  return <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] capitalize', map[status])}>{status}</span>
}

function Thread({ thread: t, me, onBack }: { thread: { recordId: string; data: JoinRequest }; me: string; onBack: () => void }) {
  const toast = useToast()
  const { person } = usePeople()
  const { records: msgs } = useQuery<Dm>('dm_messages', { where: { requestId: t.recordId } })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const isOwner = t.data.ownerId === me
  const other = isOwner ? t.data.requesterId : t.data.ownerId
  const p = person(other)
  const sorted = [...msgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const pending = t.data.status === 'pending'
  const canSend = t.data.status === 'accepted' || (pending && isOwner)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length])

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline')
    try {
      await callAction('respondToRequest', { requestId: t.recordId, accept })
      toast.success(accept ? `${p.name} joined the trip 🎉` : 'Request declined')
    } catch (err) {
      toast.error('Could not respond', (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const body = text
    setText('')
    try {
      await callAction('sendDm', { requestId: t.recordId, text: body })
    } catch (err) {
      setText(body)
      toast.error('Not sent', (err as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border p-3 sm:p-4">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1.5 hover:bg-muted md:hidden">
          <ArrowLeft className="size-4" />
        </button>
        <PersonAvatar uid={other} size={40} />
        <div className="min-w-0 flex-1">
          <Link to={`/people/${other}`} className="font-semibold hover:underline">{p.name}</Link>
          <p className="truncate text-xs text-muted-foreground">
            {p.profile?.homeCity ? `${p.profile.homeCity} · ` : ''}
            {p.profile?.travelStyle || 'Traveler'}
          </p>
        </div>
        <Link
          to={t.data.status === 'accepted' || isOwner ? `/trips/${t.data.tripId}` : `/discover/${t.data.tripId}`}
          className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs sm:inline-flex"
        >
          <MapPin className="size-3.5" /> {t.data.tripTitle}
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-background/40 p-4 sm:p-6">
        {/* Profile card at the top of the thread (Badoo / Meta Quest pattern) */}
        <div className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-5 text-center">
          <PersonAvatar uid={other} size={64} className="mx-auto" />
          <p className="font-display mt-2 text-xl font-semibold">{p.name}</p>
          {p.profile?.bio && <p className="mt-1 text-sm text-muted-foreground">{p.profile.bio}</p>}
          {!!p.profile?.interests?.length && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {p.profile.interests.slice(0, 5).map((i) => (
                <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{i}</span>
              ))}
            </div>
          )}
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            {isOwner ? 'wants to join' : 'hosts'} <b className="text-foreground">{t.data.tripTitle}</b> · {fmtDate(t.data.startDate)}–{fmtDate(t.data.endDate)}
          </p>
          <Link to={`/people/${other}`} className="mt-3 inline-flex rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">View profile</Link>
        </div>

        {sorted.map((m) =>
          m.data.senderId === 'system' ? (
            <p key={m.recordId} className="anim-in mx-auto w-fit rounded-full bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">{m.data.text}</p>
          ) : (
            <div key={m.recordId} className={cn('anim-in flex items-end gap-2', m.data.senderId === me && 'flex-row-reverse')}>
              {m.data.senderId !== me && <PersonAvatar uid={m.data.senderId} size={28} />}
              <div
                data-testid="dm"
                className={cn(
                  'max-w-[75%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm',
                  m.data.senderId === me ? 'rounded-br-md bg-foreground text-background' : 'rounded-bl-md border border-border bg-card',
                )}
              >
                {m.data.text}
              </div>
            </div>
          ),
        )}
        {t.data.status === 'accepted' && (
          <Link
            to={`/trips/${t.data.tripId}`}
            className="anim-in mx-auto flex w-fit items-center gap-2 rounded-full bg-[var(--color-honey)] px-4 py-2 text-sm font-semibold text-white shadow"
          >
            🎉 {isOwner ? `${p.name} is in` : 'You’re in'} — open the trip
          </Link>
        )}
        <div ref={endRef} />
      </div>

      {isOwner && pending && (
        <div data-testid="request-bar" className="border-t border-border bg-card p-4">
          <p className="text-sm">
            <b>Accept {p.name}’s request?</b>{' '}
            <span className="text-muted-foreground">They’ll join {t.data.tripTitle}, see the full plan and can suggest stops.</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => respond(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <X className="size-4" /> {busy === 'decline' ? 'Declining…' : 'Decline'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => respond(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              <Check className="size-4" /> {busy === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
          </div>
        </div>
      )}

      {canSend ? (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
          <input
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={`Message ${p.name.split(' ')[0]}…`}
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-foreground/40"
          />
          <button type="submit" aria-label="Send" disabled={!text.trim()} className="flex size-11 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40">
            <Send className="size-4" />
          </button>
        </form>
      ) : (
        <div data-testid="chat-locked" className="flex items-center justify-center gap-2 border-t border-border p-4 text-sm text-muted-foreground">
          <Lock className="size-4" />
          {t.data.status === 'declined' ? 'This request was declined.' : `Chat unlocks when ${p.name.split(' ')[0]} accepts`}
        </div>
      )}
    </div>
  )
}
