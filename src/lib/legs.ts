/**
 * Leg options and the "best way to get there" chooser.
 *
 * Ported from Wayfare's leg optimiser (services/agents/agents/legs.py):
 * every option is scored as `money + minutes × value-of-time + hassle`, with
 * walking capped by pace and penalised at night or in rain. The cheapest
 * score wins and the UI shows a one-line "why".
 */
import { haversineKm, type LatLng } from './geo'

export type LegMode = 'walk' | 'transit' | 'taxi'
export type Tier = 'budget' | 'mid' | 'luxury'
export type Pace = 'relaxed' | 'balanced' | 'packed'

export interface LegOption {
  mode: LegMode
  minutes: number
  /** Per-person cost in USD. */
  usd: number
  km: number
}

export interface LegChoice {
  best: LegOption
  options: LegOption[]
  why: string
}

const VALUE_OF_TIME_USD_PER_MIN: Record<Tier, number> = { budget: 0.06, mid: 0.25, luxury: 1.5 }
const TRANSIT_HASSLE_USD: Record<Tier, number> = { budget: 0.5, mid: 1, luxury: 4 }
const WALK_CAP_MIN: Record<Pace, number> = { relaxed: 15, balanced: 25, packed: 35 }
/** Under this, always walk. */
const ALWAYS_WALK_KM = 0.8
const DETOUR = 1.3
const WALK_KMH = 4.8
const TRANSIT_KMH = 20
const DRIVE_KMH = 24
const TRANSIT_WAIT_MIN = 8
const TAXI_PICKUP_MIN = 4
const TRANSIT_FARE_USD = 2.6
const MAX_TAXI_SHARE = 4
/** Taxi doesn't exist for tiny hops; transit doesn't help under ~1.2 km. */
const MIN_TRANSIT_KM = 1.2

export function tierFromDailyBudget(usdPerDay: number | undefined | null): Tier {
  if (!usdPerDay || usdPerDay <= 0) return 'mid'
  if (usdPerDay < 90) return 'budget'
  if (usdPerDay > 300) return 'luxury'
  return 'mid'
}

/** Taxi fare for the whole car, USD (Wayfare: (4 + 1.6·km + 0.35·min)·index). */
export function taxiFareUsd(km: number, minutes: number, index: number): number {
  return (4 + 1.6 * km + 0.35 * minutes) * index
}

export interface LegContext {
  index: number
  tier: Tier
  pace: Pace
  travellers: number
  /** Optional measured road/foot data from a routing service. */
  walkMinutes?: number
  walkKm?: number
  driveMinutes?: number
  driveKm?: number
  rainy?: boolean
  night?: boolean
}

/** All sensible ways to cover the hop, with per-person time and cost. */
export function legOptions(a: LatLng, b: LatLng, ctx: LegContext): LegOption[] {
  const crow = haversineKm(a, b)
  const walkKm = ctx.walkKm ?? crow * DETOUR
  const driveKm = ctx.driveKm ?? crow * DETOUR
  const walkMin = Math.round(ctx.walkMinutes ?? (walkKm / WALK_KMH) * 60)
  const driveMin = Math.round(ctx.driveMinutes ?? (driveKm / DRIVE_KMH) * 60)
  const round = (n: number) => Math.round(n * 100) / 100
  const options: LegOption[] = [{ mode: 'walk', minutes: walkMin, usd: 0, km: round(walkKm) }]
  if (crow >= MIN_TRANSIT_KM) {
    const rides = crow > 8 ? 2 : 1
    options.push({
      mode: 'transit',
      minutes: Math.round((crow * DETOUR * 60) / TRANSIT_KMH + TRANSIT_WAIT_MIN + 5),
      usd: round(rides * TRANSIT_FARE_USD * ctx.index),
      km: round(crow * DETOUR),
    })
  }
  if (crow >= ALWAYS_WALK_KM) {
    const share = Math.max(1, Math.min(MAX_TAXI_SHARE, ctx.travellers))
    options.push({
      mode: 'taxi',
      minutes: driveMin + TAXI_PICKUP_MIN,
      usd: round(taxiFareUsd(driveKm, driveMin, ctx.index) / share),
      km: round(driveKm),
    })
  }
  return options
}

function score(o: LegOption, ctx: LegContext): number {
  const vot = VALUE_OF_TIME_USD_PER_MIN[ctx.tier]
  let s = o.usd + o.minutes * vot
  if (o.mode === 'transit') s += TRANSIT_HASSLE_USD[ctx.tier]
  if (o.mode === 'walk') {
    const cap = WALK_CAP_MIN[ctx.pace]
    if (o.minutes > cap) s += (o.minutes - cap) * 1.5
    if (ctx.rainy) s += o.minutes * 0.15
    if (ctx.night) s += o.minutes * 0.1
  }
  return s
}

/** Pick the best option and explain the trade-off against the runner-up. */
export function chooseLeg(a: LatLng, b: LatLng, ctx: LegContext): LegChoice {
  const options = legOptions(a, b, ctx)
  if (haversineKm(a, b) < ALWAYS_WALK_KM) {
    const walk = options[0]
    return { best: walk, options, why: `${walk.minutes} min on foot — not worth a ride` }
  }
  const ranked = [...options].sort((x, y) => score(x, ctx) - score(y, ctx))
  const best = ranked[0]
  const alt = ranked[1]
  return { best, options, why: explain(best, alt, ctx) }
}

const LABEL: Record<LegMode, string> = { walk: 'walking', transit: 'transit', taxi: 'a taxi' }

function explain(best: LegOption, alt: LegOption | undefined, ctx: LegContext): string {
  if (!alt) return `${best.minutes} min ${LABEL[best.mode]}`
  const saved = alt.minutes - best.minutes
  const extra = best.usd - alt.usd
  if (best.mode === 'walk') return ctx.rainy ? `short enough to walk, even in the rain` : `${best.minutes} min walk saves $${alt.usd.toFixed(0)} vs ${LABEL[alt.mode]}`
  if (saved > 0 && extra > 0) return `${LABEL[best.mode]} saves ${saved} min for $${extra.toFixed(2)} more each`
  if (saved > 0) return `${LABEL[best.mode]} is quickest and cheapest`
  return `${LABEL[best.mode]} is $${(-extra).toFixed(2)} cheaper, ${-saved} min slower`
}
