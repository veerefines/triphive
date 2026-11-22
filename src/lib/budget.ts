/**
 * Whole-trip cost estimate, per person, in USD.
 *
 * Planned costs (stops with a price, TripHiver-reported spend) win over
 * general estimates; everything missing falls back to Wayfare-style unit
 * costs scaled by the destination's price index (see src/lib/money.ts).
 */
import type { Tier } from './legs'
import { haversineKm, type LatLng } from './geo'

const HOTEL_NIGHT_USD: Record<Tier, number> = { budget: 70, mid: 150, luxury: 380 }
const MEAL_USD: Record<Tier, number> = { budget: 14, mid: 32, luxury: 85 }
/** Breakfast + lunch + dinner relative to one "meal". */
const MEALS_PER_DAY = 2.4
const SHOPPING_DAY_USD: Record<Tier, number> = { budget: 10, mid: 25, luxury: 80 }
const AIRPORT_TRANSFER_KM = 25
const FLIGHT_MIN_KM = 350
const RAIL_MIN_KM = 80
const BUFFER = 0.1

export type BudgetCategory = 'travel' | 'stay' | 'food' | 'local' | 'activities' | 'shopping' | 'buffer'

export interface BudgetLine {
  category: BudgetCategory
  usd: number
  /** Where the number came from, shown in the UI. */
  basis: string
}

export interface BudgetStop {
  category?: string
  costPerPerson?: number
  /** Average per-person spend reported by TripHivers for this place. */
  communityUsd?: number
}

export interface BudgetInput {
  days: number
  travellers: number
  tier: Tier
  index: number
  stops: BudgetStop[]
  /** Sum of the chosen per-person leg costs across the trip. */
  legsUsd: number
  origin?: LatLng | null
  destination?: LatLng | null
}

export interface BudgetEstimate {
  lines: BudgetLine[]
  totalUsd: number
  perDayUsd: number
}

/** Round-trip flight per person (Wayfare: (60 + 0.11·km), ×3.2 for luxury). */
export function flightUsd(km: number, tier: Tier): number {
  return 2 * (60 + 0.11 * km) * (tier === 'luxury' ? 3.2 : 1)
}

/** Round-trip rail per person (Wayfare: max(8, 0.14·km)·index). */
export function railUsd(km: number, index: number): number {
  return 2 * Math.max(8, 0.14 * km) * index
}

const round = (n: number) => Math.round(n)

function travelLine(input: BudgetInput): BudgetLine {
  if (!input.origin || !input.destination) return { category: 'travel', usd: 0, basis: 'Add your home city to include getting there' }
  const km = haversineKm(input.origin, input.destination)
  if (km >= FLIGHT_MIN_KM) return { category: 'travel', usd: round(flightUsd(km, input.tier)), basis: `Round-trip flight · ${Math.round(km).toLocaleString()} km` }
  if (km >= RAIL_MIN_KM) return { category: 'travel', usd: round(railUsd(km, input.index)), basis: `Round-trip train or bus · ${Math.round(km)} km` }
  return { category: 'travel', usd: 0, basis: 'You’re local — no long-distance travel' }
}

function plannedCost(s: BudgetStop): number {
  return s.costPerPerson ?? s.communityUsd ?? 0
}

export function estimateTrip(input: BudgetInput): BudgetEstimate {
  const days = Math.max(1, input.days)
  const nights = Math.max(0, days - 1)
  const travellers = Math.max(1, input.travellers)
  const { tier, index } = input

  const stays = input.stops.filter((s) => s.category === 'stay')
  const plannedStay = stays.reduce((sum, s) => sum + plannedCost(s), 0)
  const rooms = Math.ceil(travellers / 2)
  const generalStay = (nights * HOTEL_NIGHT_USD[tier] * index * rooms) / travellers
  const stay: BudgetLine = plannedStay > 0
    ? { category: 'stay', usd: round(plannedStay), basis: `${stays.length} planned stay${stays.length > 1 ? 's' : ''}` }
    : { category: 'stay', usd: round(generalStay), basis: `${nights} night${nights === 1 ? '' : 's'} · ${rooms} room${rooms > 1 ? 's' : ''} shared by ${travellers}` }

  const foodStops = input.stops.filter((s) => s.category === 'food')
  const plannedFood = foodStops.reduce((sum, s) => sum + plannedCost(s), 0)
  const generalFood = days * MEALS_PER_DAY * MEAL_USD[tier] * index
  const food: BudgetLine = {
    category: 'food',
    usd: round(Math.max(generalFood, plannedFood)),
    basis: plannedFood > generalFood ? `${foodStops.length} planned meals` : `${days} days × 3 meals at local prices`,
  }

  const transfer = (2 * (4 + 1.6 * AIRPORT_TRANSFER_KM + 0.35 * 35) * index) / Math.min(4, travellers)
  const local: BudgetLine = { category: 'local', usd: round(input.legsUsd + transfer), basis: 'Best-route legs + airport transfers' }

  const things = input.stops.filter((s) => s.category !== 'food' && s.category !== 'stay')
  const activities: BudgetLine = {
    category: 'activities',
    usd: round(things.reduce((sum, s) => sum + plannedCost(s), 0)),
    basis: `${things.length} planned stop${things.length === 1 ? '' : 's'}`,
  }
  const shopping: BudgetLine = { category: 'shopping', usd: round(days * SHOPPING_DAY_USD[tier] * index), basis: 'Souvenirs & extras' }

  const core = [travelLine(input), stay, food, local, activities, shopping]
  const subtotal = core.reduce((s, l) => s + l.usd, 0)
  const buffer: BudgetLine = { category: 'buffer', usd: round(subtotal * BUFFER), basis: '10% for surprises' }
  const lines = [...core, buffer]
  const totalUsd = lines.reduce((s, l) => s + l.usd, 0)
  return { lines, totalUsd, perDayUsd: round(totalUsd / days) }
}

/** Cash worth carrying (USD): the cash-paid share of on-the-ground spend. */
export function cashToCarryUsd(est: BudgetEstimate, cashShare: number): number {
  const onGround = est.lines
    .filter((l) => l.category === 'food' || l.category === 'local' || l.category === 'shopping' || l.category === 'activities')
    .reduce((s, l) => s + l.usd, 0)
  return Math.round(onGround * cashShare)
}
