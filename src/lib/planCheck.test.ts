import { describe, expect, it } from 'vitest'
import { checkPlan, summarizeForecast, tripDates, type StopLike } from './planCheck'
import { haversineKm, nearestNeighbourOrder, routeLegs, travelMinutes } from './geo'

const trip = { startDate: '2026-12-01', endDate: '2026-12-03' }
// Lisbon landmarks
const BELEM = { lat: 38.6975, lng: -9.2033 }
const ALFAMA = { lat: 38.7118, lng: -9.1300 }
const BAIXA = { lat: 38.7108, lng: -9.1371 }

const stop = (id: string, extra: Partial<StopLike>): StopLike => ({
  id,
  date: '2026-12-01',
  title: id,
  ...extra,
})
const types = (issues: { type: string }[]) => issues.map((i) => i.type).sort()

describe('checkPlan', () => {
  it('returns nothing for a clean plan', () => {
    expect(checkPlan(trip, [stop('a', { start: '10:00', end: '11:00' })])).toEqual([])
  })

  it('flags overlapping stops', () => {
    const issues = checkPlan(trip, [
      stop('a', { start: '10:00', end: '11:30' }),
      stop('b', { start: '11:00', end: '12:00' }),
    ])
    expect(types(issues)).toEqual(['overlap'])
    expect(issues[0].stopIds).toEqual(['a', 'b'])
  })

  it('assumes 60 minutes when end is missing', () => {
    const issues = checkPlan(trip, [stop('a', { start: '10:00' }), stop('b', { start: '10:30' })])
    expect(types(issues)).toEqual(['overlap'])
  })

  it('flags infeasible travel gaps', () => {
    const issues = checkPlan(trip, [
      stop('belem', { start: '10:00', end: '11:00', ...BELEM }),
      stop('alfama', { start: '11:05', end: '12:00', ...ALFAMA }),
    ])
    expect(types(issues)).toEqual(['travel'])
    expect(issues[0].message).toMatch(/km/)
  })

  it('accepts a short walk with enough time', () => {
    const issues = checkPlan(trip, [
      stop('baixa', { start: '10:00', end: '11:00', ...BAIXA }),
      stop('alfama', { start: '11:20', end: '12:00', ...ALFAMA }),
    ])
    expect(issues).toEqual([])
  })

  it('flags stops outside the trip dates', () => {
    expect(types(checkPlan(trip, [stop('x', { date: '2026-12-09' })]))).toEqual(['outside-dates'])
  })

  it('flags an overloaded day for the slowest pace in the group', () => {
    const stops = ['08', '10', '12', '14'].map((h, i) =>
      stop(`s${i}`, { start: `${h}:00`, end: `${h}:30`, category: 'food' }),
    )
    const prefs = [
      { userId: 'u1', pace: 'packed' },
      { userId: 'u2', pace: 'chill', name: 'Ana' },
    ]
    expect(types(checkPlan(trip, stops, prefs))).toContain('overloaded')
  })

  it('flags a missing lunch on a day spanning lunchtime', () => {
    const issues = checkPlan(trip, [
      stop('a', { start: '10:00', end: '11:00', category: 'sight' }),
      stop('b', { start: '15:00', end: '16:00', category: 'sight' }),
    ])
    expect(types(issues)).toEqual(['meal-gap'])
  })

  it('does not flag lunch when a food stop exists', () => {
    const issues = checkPlan(trip, [
      stop('a', { start: '10:00', end: '11:00', category: 'sight' }),
      stop('l', { start: '12:30', end: '13:30', category: 'food' }),
      stop('b', { start: '15:00', end: '16:00', category: 'sight' }),
    ])
    expect(issues).toEqual([])
  })

  it('flags outdoor stops on rainy days', () => {
    const issues = checkPlan(
      { ...trip, forecast: { '2026-12-01': { min: 10, max: 14, desc: 'light rain', rain: true } } },
      [stop('park', { outdoor: true }), stop('museum', {})],
    )
    expect(types(issues)).toEqual(['rain'])
    expect(issues[0].stopIds).toEqual(['park'])
  })

  it('flags spend over the tightest member budget', () => {
    const issues = checkPlan(
      trip,
      [stop('a', { costPerPerson: 60 }), stop('b', { costPerPerson: 50 })],
      [
        { userId: 'u1', dailyBudget: 300 },
        { userId: 'u2', dailyBudget: 100, name: 'Sam' },
      ],
    )
    expect(types(issues)).toEqual(['budget'])
    expect(issues[0].message).toContain('Sam')
  })

  it('flags duplicate places', () => {
    const issues = checkPlan(trip, [
      stop('a', { title: 'Pastéis de Belém' }),
      stop('b', { title: 'pastéis de belém', date: '2026-12-02' }),
    ])
    expect(types(issues)).toEqual(['duplicate'])
  })

  it('flags starts before the latest riser wakes', () => {
    const issues = checkPlan(trip, [stop('a', { start: '07:30' })], [{ userId: 'u', wakeTime: '09:00', name: 'Leo' }])
    expect(types(issues)).toEqual(['early-start'])
  })
})

describe('geo', () => {
  it('computes realistic distances', () => {
    const km = haversineKm(BELEM, ALFAMA)
    expect(km).toBeGreaterThan(6)
    expect(km).toBeLessThan(7.5)
  })

  it('walks short hops and rides long ones', () => {
    const legs = routeLegs([BAIXA, ALFAMA, BELEM])
    expect(legs.map((l) => l.mode)).toEqual(['walk', 'transit'])
    expect(travelMinutes(0)).toBe(0)
  })

  it('reorders free stops by proximity and keeps fixed anchors', () => {
    const order = nearestNeighbourOrder([
      { id: 'start', ...BAIXA },
      { id: 'far', ...BELEM },
      { id: 'near', ...ALFAMA },
      { id: 'dinner', ...BAIXA, fixed: true },
    ])
    expect(order.map((p) => p.id)).toEqual(['start', 'near', 'far', 'dinner'])
  })
})

describe('dates + forecast', () => {
  it('lists inclusive trip dates', () => {
    expect(tripDates('2026-12-30', '2027-01-01')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('summarizes 3-hourly forecast into days with rain flag', () => {
    const base = Date.UTC(2026, 11, 1, 9) / 1000
    const fc = summarizeForecast([
      { dt: base, temp: 12, description: 'light rain' },
      { dt: base + 3 * 3600, temp: 15, description: 'moderate rain' },
      { dt: base + 6 * 3600, temp: 14, description: 'broken clouds' },
    ])
    expect(fc['2026-12-01']).toMatchObject({ min: 12, max: 15, rain: true })
  })
})
