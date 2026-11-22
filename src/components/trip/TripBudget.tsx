/**
 * Whole-trip cost estimate per person: getting there, stays, food, local
 * transport (best-route legs), activities, shopping and a buffer. Planned
 * costs win, then what TripHivers reported spending, then local price levels.
 * Shows the destination currency, your home currency, and cash to carry.
 */
import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import { Banknote, Wifi, WifiOff } from 'lucide-react'
import { cashToCarryUsd, estimateTrip, type BudgetCategory } from '@/lib/budget'
import { chooseLeg } from '@/lib/legs'
import { niceCash, formatMoney } from '@/lib/money'
import { cityOf, placeKey, type PlaceReviewData } from '@/lib/reviews'
import type { RecordData } from 'deepspace'
import type { Stop, Trip } from './types'
import type { TripMoney } from './useTripMoney'
import { useHomeCoords } from './useHomeCoords'

const CATEGORY_LABEL: Record<BudgetCategory, { emoji: string; label: string }> = {
  travel: { emoji: '✈️', label: 'Getting there' },
  stay: { emoji: '🛏️', label: 'Stays' },
  food: { emoji: '🍜', label: 'Food' },
  local: { emoji: '🚇', label: 'Getting around' },
  activities: { emoji: '🎟️', label: 'Things to do' },
  shopping: { emoji: '🛍️', label: 'Shopping' },
  buffer: { emoji: '🧯', label: 'Buffer' },
}

interface TripBudgetProps {
  trip: Trip
  stops: Array<RecordData<Stop>>
  dates: string[]
  money: TripMoney
  homeCity?: string
}

type Located = Stop & { lat: number; lng: number }
const isLocated = (s: Stop): s is Located => typeof s.lat === 'number' && typeof s.lng === 'number'

function useCommunitySpend(destination: string): Map<string, number> {
  const { records } = useQuery<PlaceReviewData>('place_reviews', { where: { city: cityOf(destination) } })
  return useMemo(() => {
    const sums = new Map<string, { total: number; n: number }>()
    records.forEach(({ data: r }) => {
      if (typeof r.spentUsd !== 'number') return
      const prev = sums.get(r.placeKey) ?? { total: 0, n: 0 }
      sums.set(r.placeKey, { total: prev.total + r.spentUsd, n: prev.n + 1 })
    })
    return new Map([...sums].map(([k, v]) => [k, Math.round(v.total / v.n)]))
  }, [records])
}

export function TripBudget({ trip, stops, dates, money, homeCity }: TripBudgetProps) {
  const community = useCommunitySpend(trip.destination)
  const origin = useHomeCoords(homeCity)

  const est = useMemo(() => {
    const ctx = { index: money.dest.index, tier: money.tier, pace: money.pace, travellers: money.travellers }
    const legsUsd = dates.reduce((sum, date) => {
      const day = stops
        .map((s) => s.data)
        .filter((s): s is Located => s.date === date && isLocated(s))
        .sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'))
      return sum + day.slice(1).reduce((s, b, i) => s + chooseLeg(day[i], b, ctx).best.usd, 0)
    }, 0)
    const destination = typeof trip.lat === 'number' && typeof trip.lng === 'number' ? { lat: trip.lat, lng: trip.lng } : null
    return estimateTrip({
      days: dates.length,
      travellers: money.travellers,
      tier: money.tier,
      index: money.dest.index,
      legsUsd,
      origin,
      destination,
      stops: stops.map(({ data: s }) => ({ category: s.category, costPerPerson: s.costPerPerson, communityUsd: community.get(placeKey(s.title, trip.destination)) })),
    })
  }, [trip, stops, dates, money, origin, community])

  const cashUsd = cashToCarryUsd(est, money.dest.cashShare)
  const cashLocal = money.toCurrency(cashUsd, money.dest.currency)
  const cashLabel = cashLocal == null ? formatMoney(niceCash(cashUsd), 'USD') : formatMoney(niceCash(cashLocal), money.dest.currency)
  const max = Math.max(1, ...est.lines.map((l) => l.usd))
  const homeTotal = money.homeLabel(est.totalUsd)
  const rate = money.toCurrency(1, money.dest.currency)

  return (
    <div className="space-y-4 p-4" data-testid="trip-budget">
      <section className="rounded-3xl bg-foreground p-4 text-background">
        <p className="font-mono text-[10px] uppercase tracking-wide opacity-70">Per person · {dates.length} days · {money.tier} style</p>
        <p className="mt-1 font-display text-3xl font-semibold">{money.local(est.totalUsd)}</p>
        <p className="text-sm opacity-80">{homeTotal ? `≈ ${homeTotal} in ${money.home.currency} · ` : ''}{money.local(est.perDayUsd)}/day</p>
      </section>

      <ul className="space-y-2">
        {est.lines.map((l) => (
          <li key={l.category}>
            <div className="flex items-baseline justify-between text-sm">
              <span>{CATEGORY_LABEL[l.category].emoji} {CATEGORY_LABEL[l.category].label}</span>
              <span className="font-mono text-xs">{l.usd > 0 ? money.local(l.usd) : '—'}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full origin-left rounded-full bg-honey transition-transform duration-500" style={{ transform: `scaleX(${l.usd / max})` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{l.basis}</p>
          </li>
        ))}
      </ul>

      <section className="rounded-2xl border border-border p-3">
        <p className="flex items-center gap-1.5 font-semibold"><Banknote className="size-4 text-honey" /> Carry about {cashLabel} in cash</p>
        <p className="mt-1 text-xs text-muted-foreground">
          In {money.dest.name} about {Math.round(money.dest.cashShare * 100)}% of day-to-day spend is cash ({money.dest.currency}). Cards cover the rest; get some at an airport ATM rather than exchanging at home.
        </p>
        <p className="mt-2 flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground">
          {money.isLive ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {rate != null && money.dest.currency !== 'USD' ? `1 USD = ${rate.toFixed(rate < 10 ? 2 : 0)} ${money.dest.currency} · ` : ''}
          {money.isLive ? 'live rates' : 'offline rates'}
          {homeCity ? ` · from ${homeCity}` : ' · set your home city in Profile for travel cost'}
        </p>
      </section>
    </div>
  )
}
