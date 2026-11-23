/**
 * Public trip page: what a stranger sees about a public trip (the listing
 * snapshot only), plus the "ask to join" pitch composer.
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowLeft, CalendarDays, Lock, MapPin, MessageCircle, Send, Users } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { FeaturedCard, PersonAvatar, ProfilePeek, VIBE_EMOJI, fmtDate, usePeople, type JoinRequest, type Listing } from '@/components/social'
import { DestinationCover } from '@/components/social/DestinationCover'
import { featuredNear } from '@/data/featured'
import { callAction } from '@/lib/api'
import { tripDates } from '@/lib/planCheck'

export default function PublicTripPage() {
  const { tripId = '' } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { person } = usePeople()
  const { records, status } = useQuery<Listing>('public_trips', { where: { tripId } })
  const { records: myReq } = useQuery<JoinRequest>('join_requests', { where: { tripId, requesterId: userId ?? '' } })
  const { records: mine } = useQuery<{ title: string }>('trips', { where: { teamId: tripId } })
  const [pitch, setPitch] = useState('')
  const [sending, setSending] = useState(false)

  const l = records[0]?.data
  if (status === 'loading') return <div className="mx-auto max-w-5xl px-6 py-10"><div className="skeleton h-80 rounded-[28px]" /></div>
  if (!l)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="font-display mt-3 text-2xl font-semibold">This trip isn’t public</h1>
        <p className="mt-1 text-sm text-muted-foreground">It may have been made private or deleted.</p>
        <Link to="/discover" className="mt-5 inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">Back to Discover</Link>
      </div>
    )

  const host = person(l.ownerId)
  const req = myReq.find((r) => r.data.status !== 'declined') ?? myReq[0]
  const isMember = mine.length > 0
  const days = tripDates(l.startDate, l.endDate).length
  const spots = Number(l.openSpots ?? 0)
  const featured = featuredNear(l)

  async function send(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      await callAction('requestToJoin', { tripId, pitch })
      toast.success('Request sent', `${host.name} will see it in their inbox`)
      navigate('/inbox')
    } catch (err) {
      toast.error('Could not send', (err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-6">
      <Link to="/discover" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Discover
      </Link>
      <div className="group relative h-64 overflow-hidden rounded-[28px] border border-border bg-muted sm:h-80">
        <DestinationCover
          destination={l.destination}
          lat={l.lat}
          lng={l.lng}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <p className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/80">
            <MapPin className="size-3" /> {l.destination}
          </p>
          <h1 className="font-display mt-1 text-4xl font-bold leading-tight sm:text-5xl">{l.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[12px] text-white/85">
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {fmtDate(l.startDate)} – {fmtDate(l.endDate)} · {days} days</span>
            <span className="flex items-center gap-1"><Users className="size-3.5" /> {l.memberCount ?? 1} going · {spots > 0 ? `${spots} open` : 'full'}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {l.description && <p className="text-lg leading-relaxed">{l.description}</p>}
          {!!l.vibes?.length && (
            <div className="flex flex-wrap gap-2">
              {l.vibes.map((v) => (
                <span key={v} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">{VIBE_EMOJI[v]} {v}</span>
              ))}
            </div>
          )}
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-display text-xl font-semibold">The plan so far</h2>
            {l.highlights?.length ? (
              <ol className="mt-4 space-y-3">
                {l.highlights.map((h, i) => (
                  <li key={h.date} className="flex gap-3">
                    <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-full bg-foreground text-background">
                      <span className="text-[9px] leading-none opacity-70">DAY</span>
                      <span className="text-xs font-bold leading-none">{i + 1}</span>
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-mono text-[11px] text-muted-foreground">{fmtDate(h.date)}</p>
                      <p className="text-sm">{h.titles.join(' · ')}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Still a blank canvas — join and shape it together.</p>
            )}
            <p className="mt-4 flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
              <Lock className="size-3" /> Full itinerary, times and group chat unlock when the host accepts you.
            </p>
          </div>
          {featured.length > 0 && (
            <div>
              <h2 className="font-display mb-3 text-xl font-semibold">TripHive Featured nearby</h2>
              <div className="scrollbar-none -mx-6 flex gap-4 overflow-x-auto px-6 pb-2">
                {featured.map((f) => <FeaturedCard key={f.id} place={f} compact />)}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ProfilePeek uid={l.ownerId} className="card-lift flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4">
            <PersonAvatar uid={l.ownerId} size={52} />
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Your host</p>
              <p className="font-display truncate text-lg font-semibold">{l.hostName || host.name}</p>
              <p className="truncate text-xs text-muted-foreground">{host.profile?.homeCity ? `From ${host.profile.homeCity}` : 'View profile'}{host.profile?.travelStyle ? ` · ${host.profile.travelStyle}` : ''}</p>
            </div>
          </ProfilePeek>

          {l.ownerId === userId || isMember ? (
            <Link to={`/trips/${tripId}`} className="flex items-center justify-center gap-2 rounded-3xl bg-foreground p-4 text-sm font-semibold text-background">
              You’re on this trip · Open plan
            </Link>
          ) : req?.data.status === 'pending' ? (
            <div className="rounded-3xl border border-border bg-card p-5 text-center">
              <p className="text-3xl">⏳</p>
              <p className="font-semibold">Request sent</p>
              <p className="mt-1 text-sm text-muted-foreground">Waiting for {host.name} to accept. Chat unlocks once they do.</p>
              <Link to="/inbox" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm"><MessageCircle className="size-4" /> Open inbox</Link>
            </div>
          ) : req?.data.status === 'declined' ? (
            <div className="rounded-3xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">The host declined this request. Plenty more trips on Discover!</div>
          ) : spots <= 0 ? (
            <div className="rounded-3xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">This trip is full.</div>
          ) : (
            <form onSubmit={send} className="rounded-3xl bg-foreground p-5 text-background">
              <h2 className="font-display text-xl font-semibold">Ask to join</h2>
              <p className="mt-1 text-xs text-background/65">Your pitch goes to {host.name} as a chat request with your profile.</p>
              <textarea
                aria-label="Your pitch"
                required
                minLength={10}
                maxLength={600}
                rows={5}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder={`Hi ${host.name.split(' ')[0]}! I’m in ${l.destination} the same week — love food markets and sunset walks. Would be fun to explore together.`}
                className="mt-3 w-full resize-none rounded-2xl border border-background/15 bg-background/10 p-3 text-sm text-background outline-none placeholder:text-background/40 focus:border-[var(--color-honey)]"
              />
              <Button type="submit" loading={sending} disabled={pitch.trim().length < 10} className="mt-3 w-full bg-[var(--color-honey)] text-white hover:bg-[var(--color-honey)]/90">
                <Send className="size-4" /> Send request
              </Button>
            </form>
          )}
        </aside>
      </div>
    </div>
  )
}
