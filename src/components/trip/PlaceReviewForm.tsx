/**
 * TripHiver review form: 1-5 stars, a tip for the next group and spend per
 * person. Saves through the reviewPlace action (one review per user per place).
 */
import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button, cn, useToast } from '@/components/ui'
import { callAction } from '@/lib/api'

const STARS = [1, 2, 3, 4, 5]

export function StarPicker({ name, value, onChange }: { name: string; value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label={`Rate ${name}`} onMouseLeave={() => setHover(0)}>
      {STARS.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} aria-label={`${s} stars`} onMouseEnter={() => setHover(s)} onClick={() => onChange(s)} className="transition-transform hover:scale-125 active:scale-95">
          <Star className={cn('size-6', s <= shown ? 'fill-[var(--color-honey)] text-honey' : 'text-muted-foreground/50')} />
        </button>
      ))}
    </div>
  )
}

export function RateRow({ tripId, name, onDone }: { tripId: string; name: string; onDone: () => void }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [spent, setSpent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function save() {
    setIsSaving(true)
    try {
      await callAction('reviewPlace', { tripId, name, rating, text, spentUsd: spent ? Number(spent) : undefined })
      toast.success('Thanks, TripHiver!', `Your review of ${name} helps the next group.`)
      onDone()
    } catch (err) {
      toast.error('Review not saved', (err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="anim-in mx-3 mt-2 space-y-2 rounded-xl border border-border p-2.5">
      <StarPicker name={name} value={rating} onChange={setRating} />
      <input value={text} maxLength={600} onChange={(e) => setText(e.target.value)} placeholder="What should the next group know?" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
      <div className="flex items-center gap-2">
        <input value={spent} inputMode="decimal" onChange={(e) => setSpent(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Spent pp (USD)" aria-label="Spent per person in USD" className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
        <Button size="sm" disabled={!rating} loading={isSaving} onClick={save}>Save review</Button>
      </div>
    </div>
  )
}
