/** Public traveler profile: about, interests and the public trips they host. */
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowLeft, Globe, Home, Languages } from 'lucide-react'
import { PersonAvatar, PublicTripCard, usePeople, type Listing } from '@/components/social'

export default function PersonPage() {
  const { userId: uid = '' } = useParams()
  const { userId } = useAuth()
  const { person } = usePeople()
  const p = person(uid)
  const { records: hosted } = useQuery<Listing>('public_trips', { where: { ownerId: uid } })
  const cities = new Set(hosted.map((h) => h.data.destination.split(',')[0]))

  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-6">
      <button type="button" onClick={() => history.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </button>
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card">
        <div className="h-28 bg-gradient-to-r from-[var(--color-honey-soft)] via-[var(--color-muted)] to-[var(--color-honey-soft)]" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <PersonAvatar uid={uid} size={96} ring className="border-4 border-card bg-card" />
            {uid === userId && (
              <Link to="/profile" className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Edit profile</Link>
            )}
          </div>
          <h1 className="font-display mt-3 text-4xl font-bold">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {p.profile?.homeCity && <span className="flex items-center gap-1"><Home className="size-3.5" /> {p.profile.homeCity}</span>}
            {p.profile?.travelStyle && <span className="flex items-center gap-1"><Globe className="size-3.5" /> {p.profile.travelStyle}</span>}
            {p.profile?.languages && <span className="flex items-center gap-1"><Languages className="size-3.5" /> {p.profile.languages}</span>}
          </p>
          {p.profile?.bio ? (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed">{p.profile.bio}</p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {p.profile || uid === userId ? 'No bio yet.' : '🔒 This traveler keeps their profile private. You’ll see it once you share a trip or a join request.'}
            </p>
          )}
          {!!p.profile?.interests?.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {p.profile.interests.map((i) => (
                <span key={i} className="rounded-full border border-border bg-background px-3 py-1 text-sm">{i}</span>
              ))}
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-sm">
            <Stat n={hosted.length} label="Public trips" />
            <Stat n={cities.size} label="Destinations" />
          </div>
        </div>
      </section>

      <h2 className="font-display mb-4 mt-10 text-2xl font-bold">Hosting</h2>
      {hosted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No public trips right now.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {hosted.map((h, i) => <PublicTripCard key={h.recordId} listing={h.data} delay={i * 50} />)}
        </div>
      )}
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-muted px-4 py-3">
      <p className="font-display text-2xl font-bold">{n}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
