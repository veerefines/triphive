/**
 * Compact fact blocks for the place sheet: rating stat cards, Hive's chips
 * and an opening-hours list that leads with today.
 */
import { useState } from 'react'
import { ChevronDown, Clock, Star } from 'lucide-react'
import { cn } from '@/components/ui'
import { HiveAvatar } from '@/components/ui/Brand'
import type { TripMoney } from '../useTripMoney'
import type { Community } from '../usePlaceInsights'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-honey)]'

function StatCard({ icon, value, label, sub }: { icon: React.ReactNode; value: string; label: string; sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-honey-soft">{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {label}
          {sub && <span className="text-muted-foreground/70"> · {sub}</span>}
        </p>
      </div>
    </div>
  )
}

interface RatingCardsProps {
  rating?: number
  ratingCount?: number
  community: Community
  money: TripMoney
}

export function RatingCards({ rating, ratingCount, community, money }: RatingCardsProps) {
  const hasGoogle = typeof rating === 'number'
  const hiverValue = community.count && community.avgRating != null ? community.avgRating.toFixed(1) : 'New'
  const hiverLabel = community.count ? `${community.count} TripHiver${community.count === 1 ? '' : 's'}` : 'No TripHiver ratings yet'
  const spent = community.avgSpentUsd != null ? `~${money.local(community.avgSpentUsd)} spent` : undefined
  return (
    <div className={cn('grid gap-2.5', hasGoogle && 'sm:grid-cols-2')}>
      {hasGoogle && (
        <StatCard
          icon={<Star className="size-5 fill-[var(--color-honey)] text-[var(--color-honey)]" aria-hidden />}
          value={rating.toFixed(1)}
          label={ratingCount ? `${ratingCount.toLocaleString()} Google ratings` : 'Google rating'}
        />
      )}
      <StatCard icon={<HiveAvatar size={24} />} value={hiverValue} label={hiverLabel} sub={spent} />
    </div>
  )
}

export function HiveChips({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <HiveAvatar size={16} /> {title}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <li key={t} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}

const todayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' })

/** Splits Google's "Monday: 9 AM – 5 PM" into day and time. */
function splitHours(line: string): { day: string; time: string } {
  const at = line.indexOf(':')
  return at > 0 ? { day: line.slice(0, at), time: line.slice(at + 1).trim() } : { day: '', time: line }
}

export function OpeningHours({ hours, openNow }: { hours: string[]; openNow?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const rows = hours.map(splitHours)
  const today = rows.find((r) => r.day === todayName())
  const status = openNow == null ? null : openNow ? 'Open now' : 'Closed now'
  return (
    <section className="rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className={cn('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm', focusRing)}
      >
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {status && <b className={openNow ? 'text-success' : 'text-destructive'}>{status}</b>}
          {status && today && <span className="text-muted-foreground"> · </span>}
          {today ? <span>Today {today.time}</span> : !status && <span>Opening hours</span>}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden />
      </button>
      {isOpen && (
        <ul className="space-y-1 border-t border-border px-4 py-3 text-xs">
          {rows.map((r) => (
            <li key={`${r.day}${r.time}`} className={cn('flex justify-between gap-4', r === today ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              <span>{r.day}</span>
              <span className="text-right tabular-nums">{r.time}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
