/**
 * Trip-wide money context: destination currency + price level, the viewer's
 * home currency, live FX (Frankfurter, CORS-enabled, no key) with offline
 * fallback, and the group's tier/pace for leg choice.
 */
import { useEffect, useMemo, useState } from 'react'
import { COUNTRIES, FALLBACK_USD_RATES, convert, countryFor, countryFromLocale, formatMoney, type CountryInfo } from '@/lib/money'
import { tierFromDailyBudget, type Pace, type Tier } from '@/lib/legs'
import type { Pref, Trip } from './types'

const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=USD'
const FX_CACHE_KEY = 'triphive:fx'
const FX_MAX_AGE_MS = 6 * 60 * 60 * 1000
const FX_TIMEOUT_MS = 6000
const DEFAULT_COUNTRY: CountryInfo = COUNTRIES.US

let ratesPromise: Promise<{ rates: Record<string, number>; isLive: boolean }> | null = null

function loadRates() {
  if (ratesPromise) return ratesPromise
  ratesPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY) ?? 'null') as { at: number; rates: Record<string, number> } | null
      if (cached && Date.now() - cached.at < FX_MAX_AGE_MS) return { rates: { ...FALLBACK_USD_RATES, ...cached.rates, USD: 1 }, isLive: true }
    } catch {
      /* corrupt cache: refetch below */
    }
    try {
      const res = await fetch(FX_URL, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) })
      if (!res.ok) throw new Error(`FX ${res.status}`)
      const json = (await res.json()) as { rates?: Record<string, unknown> }
      const live = Object.fromEntries(
        Object.entries(json.rates ?? {}).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0),
      )
      localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ at: Date.now(), rates: live }))
      return { rates: { ...FALLBACK_USD_RATES, ...live, USD: 1 }, isLive: true }
    } catch {
      return { rates: FALLBACK_USD_RATES, isLive: false }
    }
  })()
  return ratesPromise
}

export interface TripMoney {
  dest: CountryInfo
  home: CountryInfo
  rates: Record<string, number>
  isLive: boolean
  tier: Tier
  pace: Pace
  travellers: number
  /** USD → destination-currency label. */
  local: (usd: number) => string
  /** USD → viewer's home-currency label, or null when it matches the destination. */
  homeLabel: (usd: number) => string | null
  toCurrency: (usd: number, currency: string) => number | null
}

const PACES: Pace[] = ['relaxed', 'balanced', 'packed']

function groupPace(prefs: Pref[]): Pace {
  const counts = new Map<Pace, number>()
  prefs.forEach((p) => {
    const pace = PACES.find((x) => x === p.pace)
    if (pace) counts.set(pace, (counts.get(pace) ?? 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'balanced'
}

export function useTripMoney(trip: Pick<Trip, 'destination' | 'title'> | undefined, prefs: Pref[], travellers: number, homeCity?: string | null): TripMoney {
  const [fx, setFx] = useState({ rates: FALLBACK_USD_RATES, isLive: false })
  useEffect(() => {
    let alive = true
    loadRates().then((r) => alive && setFx(r))
    return () => {
      alive = false
    }
  }, [])

  return useMemo(() => {
    const dest = countryFor(trip?.destination) ?? countryFor(trip?.title) ?? DEFAULT_COUNTRY
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
    const home = countryFor(homeCity) ?? countryFromLocale(locale) ?? DEFAULT_COUNTRY
    const budgets = prefs.map((p) => p.dailyBudget).filter((b): b is number => typeof b === 'number' && b > 0)
    // The tightest budget in the group sets the tier so nobody is priced out.
    const tier = tierFromDailyBudget(budgets.length ? Math.min(...budgets) : undefined)
    const toCurrency = (usd: number, currency: string) => convert(usd, 'USD', currency, fx.rates)
    const label = (usd: number, currency: string) => {
      const v = toCurrency(usd, currency)
      return v == null ? formatMoney(usd, 'USD') : formatMoney(v, currency)
    }
    return {
      dest,
      home,
      rates: fx.rates,
      isLive: fx.isLive,
      tier,
      pace: groupPace(prefs),
      travellers: Math.max(1, travellers),
      local: (usd: number) => label(usd, dest.currency),
      homeLabel: (usd: number) => (home.currency === dest.currency ? null : label(usd, home.currency)),
      toCurrency,
    }
  }, [trip?.destination, trip?.title, homeCity, prefs, travellers, fx])
}
