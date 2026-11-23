/**
 * Floating "Ask Hive" button on every signed-in page except a trip page
 * (which already has the Hive panel). Hive only runs inside a trip the user
 * belongs to (the chat route enforces it), so the button asks which trip, then
 * opens that trip with the Hive tab focused and the question pre-filled.
 */
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Bot, Plus, Send } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'

const MAX_TRIPS = 6
const MAX_PROMPT = 500
const TRIP_PAGE = /^\/trips\/[^/]+/

type TripRow = { title: string; destination: string; startDate: string }

/** URL that opens a trip with Hive focused; the trip page reads `?hive=`. */
export function hiveUrl(tripId: string, prompt: string): string {
  const q = prompt.trim().slice(0, MAX_PROMPT)
  return `/trips/${tripId}?hive=${encodeURIComponent(q || '1')}`
}

function TripPicker({ onPick }: { onPick: (tripId: string | null, prompt: string) => void }) {
  const [prompt, setPrompt] = useState('')
  // RBAC scopes `trips` to the user's own trips.
  const { records } = useQuery<TripRow>('trips', { orderBy: 'startDate', orderDir: 'asc' })
  const trips = records.slice(0, MAX_TRIPS)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (trips.length === 1) onPick(trips[0].recordId, prompt)
  }

  return (
    <div data-testid="ask-hive-picker" className="w-80 p-3 text-sm">
      <p className="font-display text-base font-semibold">Ask Hive</p>
      <p className="mb-2 text-xs text-muted-foreground">Hive plans inside a trip, so it knows your dates, group and budget.</p>
      <form onSubmit={handleSubmit} className="mb-3 flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        <input
          aria-label="Question for Hive"
          value={prompt}
          maxLength={MAX_PROMPT}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Plan day 1 around food…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <Send className="size-3.5 text-muted-foreground" aria-hidden />
      </form>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Which trip?</p>
      <ul className="space-y-1">
        {trips.map((t) => (
          <li key={t.recordId}>
            <button
              type="button"
              onClick={() => onPick(t.recordId, prompt)}
              className="flex w-full flex-col rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="truncate font-medium">{t.data.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t.data.destination} · {t.data.startDate}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onPick(null, prompt)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <Plus className="size-3.5" aria-hidden /> {trips.length ? 'Start a new trip' : 'Create your first trip'}
      </button>
    </div>
  )
}

export function AskHiveFab() {
  const { isSignedIn } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (!isSignedIn || TRIP_PAGE.test(pathname)) return null

  function handlePick(tripId: string | null, prompt: string) {
    setOpen(false)
    navigate(tripId ? hiveUrl(tripId, prompt) : '/trips')
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 md:bottom-7 md:right-7">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Ask Hive"
          data-testid="ask-hive-fab"
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20',
            'transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          )}
        >
          <Bot className="size-4" aria-hidden /> Ask Hive
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="pointer-events-auto">
          {open && <TripPicker onPick={handlePick} />}
        </PopoverContent>
      </Popover>
    </div>
  )
}
