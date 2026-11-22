import { describe, expect, test } from 'vitest'
import { cashToCarryUsd, estimateTrip, flightUsd } from './budget'
import { chooseLeg, legOptions, tierFromDailyBudget } from './legs'
import { convert, countryFor, countryFromLocale, formatMoney, niceCash, FALLBACK_USD_RATES } from './money'

const LISBON = { lat: 38.7223, lng: -9.1393 }
const NEW_YORK = { lat: 40.7128, lng: -74.006 }

describe('money', () => {
  test('detects country and currency from a destination string', () => {
    expect(countryFor('Lisbon, Portugal')?.currency).toBe('EUR')
    expect(countryFor('Shillong, Meghalaya')?.code).toBe('IN')
    expect(countryFor('Tōkyō')?.currency).toBe('JPY')
    expect(countryFor('Somewhere unknown')).toBeNull()
  })

  test('prefers the last place word so the country wins over a city name', () => {
    expect(countryFor('Paris, Texas, USA')?.code).toBe('US')
  })

  test('reads the region from a browser locale', () => {
    expect(countryFromLocale('en-IN')?.currency).toBe('INR')
    expect(countryFromLocale('en')).toBeNull()
  })

  test('converts through USD rates', () => {
    expect(convert(100, 'USD', 'EUR', { USD: 1, EUR: 0.9 })).toBeCloseTo(90)
    expect(convert(90, 'EUR', 'USD', { USD: 1, EUR: 0.9 })).toBeCloseTo(100)
    expect(convert(1, 'USD', 'XXX', FALLBACK_USD_RATES)).toBeNull()
  })

  test('formats and rounds cash', () => {
    expect(formatMoney(42, 'EUR')).toBe('€42')
    expect(formatMoney(3900.4, 'INR')).toBe('₹3,900')
    expect(niceCash(437)).toBe(440)
    expect(niceCash(12345)).toBe(13000)
    expect(niceCash(0)).toBe(0)
  })
})

describe('legs', () => {
  const ctx = { index: 0.8, tier: 'mid' as const, pace: 'balanced' as const, travellers: 2 }

  test('always walks a short hop', () => {
    const c = chooseLeg(LISBON, { lat: 38.7253, lng: -9.1393 }, ctx)
    expect(c.best.mode).toBe('walk')
    expect(c.options).toHaveLength(1)
  })

  test('offers walk, transit and taxi for a cross-town hop', () => {
    const opts = legOptions(LISBON, { lat: 38.6975, lng: -9.2033 }, ctx)
    expect(opts.map((o) => o.mode)).toEqual(['walk', 'transit', 'taxi'])
    expect(opts.find((o) => o.mode === 'taxi')!.usd).toBeGreaterThan(opts.find((o) => o.mode === 'transit')!.usd)
  })

  test('does not pick a long walk over the pace cap', () => {
    const c = chooseLeg(LISBON, { lat: 38.6975, lng: -9.2033 }, ctx)
    expect(c.best.mode).not.toBe('walk')
    expect(c.why.length).toBeGreaterThan(5)
  })

  test('luxury travellers take the taxi', () => {
    const c = chooseLeg(LISBON, { lat: 38.6975, lng: -9.2033 }, { ...ctx, tier: 'luxury' })
    expect(c.best.mode).toBe('taxi')
  })

  test('maps daily budget to a tier', () => {
    expect(tierFromDailyBudget(60)).toBe('budget')
    expect(tierFromDailyBudget(150)).toBe('mid')
    expect(tierFromDailyBudget(500)).toBe('luxury')
    expect(tierFromDailyBudget(undefined)).toBe('mid')
  })
})

describe('budget', () => {
  const base = { days: 3, travellers: 2, tier: 'mid' as const, index: 0.8, stops: [], legsUsd: 10 }

  test('estimates every category and adds a 10% buffer', () => {
    const est = estimateTrip(base)
    const by = Object.fromEntries(est.lines.map((l) => [l.category, l.usd]))
    expect(by.stay).toBe(120) // 2 nights × 150 × 0.8 × 1 room / 2 people
    expect(by.food).toBe(184) // 3 × 2.4 × 32 × 0.8
    expect(by.travel).toBe(0)
    const subtotal = est.lines.filter((l) => l.category !== 'buffer').reduce((s, l) => s + l.usd, 0)
    expect(by.buffer).toBe(Math.round(subtotal * 0.1))
    expect(est.totalUsd).toBe(subtotal + by.buffer)
  })

  test('uses planned stay and TripHiver-reported spend over general estimates', () => {
    const est = estimateTrip({ ...base, stops: [{ category: 'stay', costPerPerson: 90 }, { category: 'sight', communityUsd: 15 }] })
    const by = Object.fromEntries(est.lines.map((l) => [l.category, l.usd]))
    expect(by.stay).toBe(90)
    expect(by.activities).toBe(15)
  })

  test('adds a long-haul flight when the origin is far away', () => {
    const est = estimateTrip({ ...base, origin: NEW_YORK, destination: LISBON })
    const travel = est.lines.find((l) => l.category === 'travel')!
    expect(travel.usd).toBeGreaterThan(1000)
    expect(travel.basis).toMatch(/flight/)
    expect(flightUsd(1000, 'luxury')).toBeCloseTo(flightUsd(1000, 'mid') * 3.2)
  })

  test('suggests cash from the on-the-ground spend share', () => {
    const est = estimateTrip(base)
    expect(cashToCarryUsd(est, 0)).toBe(0)
    expect(cashToCarryUsd(est, 0.5)).toBeGreaterThan(0)
  })
})
