import { describe, expect, it } from 'vitest'
import { DEMO_PROFILES, DEMO_REVIEWS, DEMO_TRIPS, ME } from '../data/demo'
import { addDays, planSeed, type PlanInput } from './demoPlan'
import { placeKey } from './reviews'

const CATEGORIES = new Set(['food', 'sight', 'activity', 'stay', 'transport', 'other'])
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function input(): PlanInput {
  let n = 0
  return {
    ownerId: 'owner_1',
    ownerName: 'Owner',
    today: '2026-11-23',
    hiveSender: 'hive',
    newId: (p) => `${p}_${++n}`,
    inviteCode: () => 'ABC234',
    nowIso: '2026-11-23T00:00:00.000Z',
  }
}

describe('demo data', () => {
  it('has unique trip keys and persona ids', () => {
    expect(new Set(DEMO_TRIPS.map((t) => t.key)).size).toBe(DEMO_TRIPS.length)
    expect(new Set(DEMO_PROFILES.map((p) => p.userId)).size).toBe(DEMO_PROFILES.length)
  })

  it('keeps every stop valid: category, coords, times and day within the trip', () => {
    for (const t of DEMO_TRIPS) {
      expect(t.members).toContain(t.host)
      for (const s of t.stops) {
        expect(CATEGORIES.has(s.category)).toBe(true)
        expect(Math.abs(s.lat)).toBeLessThanOrEqual(90)
        expect(Math.abs(s.lng)).toBeLessThanOrEqual(180)
        expect(s.start).toMatch(HHMM)
        expect(s.end).toMatch(HHMM)
        expect(s.end > s.start).toBe(true)
        expect(s.day).toBeGreaterThanOrEqual(0)
        expect(s.day).toBeLessThan(t.days)
      }
      expect(t.hive.card.day).toBeLessThan(t.days)
    }
  })

  it('only lets members chat and sets prefs only for members', () => {
    for (const t of DEMO_TRIPS) {
      for (const m of t.chat) expect(t.members).toContain(m.from)
      for (const u of Object.keys(t.prefs)) expect(t.members).toContain(u)
    }
  })

  it('reviews only places that appear in some demo trip', () => {
    const keys = new Set(DEMO_TRIPS.flatMap((t) => t.stops.map((s) => placeKey(s.title, t.destination))))
    for (const r of DEMO_REVIEWS) expect(keys.has(placeKey(r.place, r.destination))).toBe(true)
  })

  it('never has a pending request from someone already on the trip', () => {
    for (const t of DEMO_TRIPS) {
      for (const r of t.requests) {
        if (r.status === 'pending') expect(t.members).not.toContain(r.requester)
        else expect(t.members).toContain(r.requester)
      }
    }
  })
})

describe('planSeed', () => {
  it('replaces ME with the owner id everywhere', () => {
    const plan = planSeed(input())
    expect(JSON.stringify(plan)).not.toContain(ME)
    expect(plan.members.some((m) => m.userId === 'owner_1' && m.role === 'owner')).toBe(true)
  })

  it('dates trips from today using the day offsets', () => {
    const plan = planSeed(input())
    const lisbon = plan.trips.find((t) => t.data.title === 'Lisbon long weekend')!
    expect(lisbon.data.startDate).toBe('2026-12-11')
    expect(lisbon.data.endDate).toBe('2026-12-13')
    expect(lisbon.data.visibility).toBe('public')
  })

  it('writes one listing per public trip with a real host name', () => {
    const plan = planSeed(input())
    expect(plan.listings).toHaveLength(DEMO_TRIPS.filter((t) => t.listing).length)
    expect(plan.listings.map((l) => l.hostName)).toEqual(expect.arrayContaining(['Owner', 'Aiko Tanaka', 'Marco Rossi']))
    expect(plan.listings.every((l) => l.hostName !== 'Traveler')).toBe(true)
  })

  it('ends each trip chat with a Hive card dated inside the trip', () => {
    const plan = planSeed(input())
    for (const trip of plan.trips) {
      const msgs = plan.messages.filter((m) => m.tripId === trip.id)
      const last = msgs[msgs.length - 1]!
      expect(last.senderId).toBe('hive')
      const card = (last.cards as { date: string }[])[0]!
      expect(card.date >= String(trip.data.startDate) && card.date <= String(trip.data.endDate)).toBe(true)
    }
  })

  it('threads every DM to a planned request and starts each thread with the pitch', () => {
    const plan = planSeed(input())
    const ids = new Set(plan.requests.map((r) => r.id))
    for (const dm of plan.dms) expect(ids.has(String(dm.requestId))).toBe(true)
    for (const r of plan.requests) {
      const first = plan.dms.find((d) => d.requestId === r.id)!
      expect(first.text).toBe(r.data.pitch)
    }
  })

  it('links each review to the trip in its city', () => {
    const plan = planSeed(input())
    const tripIds = new Set(plan.trips.map((t) => t.id))
    for (const r of plan.reviews) expect(tripIds.has(String(r.tripId))).toBe(true)
  })

  it('writes prefs and profiles as the user they belong to', () => {
    const plan = planSeed(input())
    for (const p of plan.profiles) expect(p.as).toBe(p.data.userId)
    expect(plan.prefs.every((p) => p.as.length > 0)).toBe(true)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})
