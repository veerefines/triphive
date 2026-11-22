/** Edit my traveler profile — what hosts see when I ask to join a trip. */
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useQuery, useUsers } from 'deepspace'
import { Button, Input, Label, Textarea, cn, useToast } from '@/components/ui'
import type { Profile } from '@/components/social'
import { callAction } from '@/lib/api'

const EMOJIS = ['🧳', '🎒', '🏄', '🧗', '📸', '🍜', '🌋', '🚲', '🐝', '🦊', '🐢', '🌸', '☕', '🎧', '🗺️', '⛺']
const STYLES = ['Planner', 'Go with the flow', 'Foodie', 'Early bird', 'Night owl', 'Budget backpacker', 'Comfort first']
const INTERESTS = ['Street food', 'Museums', 'Hiking', 'Nightlife', 'Coffee', 'Beaches', 'Photography', 'Markets', 'Architecture', 'Live music', 'Wellness', 'Wildlife']

export default function ProfilePage() {
  const { userId } = useAuth()
  const { users } = useUsers()
  const toast = useToast()
  const { records, status } = useQuery<Profile>('profiles', { where: { userId: userId ?? '' } })
  const mine = records[0]?.data
  const accountName = users.find((u) => u.id === userId)?.name ?? ''
  const [form, setForm] = useState<Omit<Profile, 'userId'>>({ avatarEmoji: '🧳', interests: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mine) setForm(mine)
    else if (status === 'ready') setForm((f) => ({ ...f, displayName: f.displayName || accountName }))
  }, [mine, status, accountName])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await callAction('saveProfile', form)
      toast.success('Profile saved')
    } catch (err) {
      toast.error('Could not save', (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = (i: string) =>
    setForm((f) => ({ ...f, interests: f.interests?.includes(i) ? f.interests.filter((x) => x !== i) : [...(f.interests ?? []), i].slice(0, 12) }))

  return (
    <div className="mx-auto max-w-2xl px-6 pb-20 pt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Your traveler profile</p>
      <h1 className="font-display mt-1 text-5xl font-bold tracking-tight">Hello, {form.displayName?.split(' ')[0] || 'traveler'} {form.avatarEmoji}</h1>
      <p className="mt-2 text-muted-foreground">Hosts see this when you ask to join their trip.{userId && <> <Link className="underline" to={`/people/${userId}`}>Preview public profile</Link></>}</p>

      <form onSubmit={save} className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-6">
        <div>
          <Label>Avatar</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Avatar ${e}`}
                onClick={() => setForm({ ...form, avatarEmoji: e })}
                className={cn('flex size-11 items-center justify-center rounded-full text-xl transition', form.avatarEmoji === e ? 'bg-foreground ring-4 ring-[var(--color-honey-soft)]' : 'bg-muted hover:scale-110')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Display name</Label>
            <Input id="pf-name" maxLength={60} value={form.displayName ?? ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-city">Home city</Label>
            <Input id="pf-city" maxLength={80} placeholder="Mumbai" value={form.homeCity ?? ''} onChange={(e) => setForm({ ...form, homeCity: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-bio">About you</Label>
          <Textarea id="pf-bio" maxLength={400} rows={3} placeholder="Designer, chasing sunsets and street food. Happy to split cabs and plan the mornings." value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div>
          <Label>Travel style</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button key={s} type="button" onClick={() => setForm({ ...form, travelStyle: s })} className={cn('rounded-full border px-3 py-1.5 text-sm', form.travelStyle === s ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Interests</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button key={i} type="button" aria-pressed={form.interests?.includes(i)} onClick={() => toggle(i)} className={cn('rounded-full border px-3 py-1.5 text-sm', form.interests?.includes(i) ? 'border-[var(--color-honey)] bg-[var(--color-honey-soft)]' : 'border-border hover:border-foreground/40')}>
                {i}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-lang">Languages</Label>
          <Input id="pf-lang" maxLength={120} placeholder="English, Hindi, a little Portuguese" value={form.languages ?? ''} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
        </div>
        <Button type="submit" loading={saving} className="w-full">Save profile</Button>
      </form>
    </div>
  )
}
