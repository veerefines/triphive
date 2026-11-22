import { describe, expect, it } from 'vitest'
import { dateRelation, matchTrips } from './match'

const lisbon = { lat: 38.7223, lng: -9.1393 }
const mine = { id: 'me', destination: 'Lisbon', startDate: '2026-12-10', endDate: '2026-12-14', ...lisbon }

describe('matchTrips', () => {
  it('matches an overlapping trip in the same city', () => {
    const r = matchTrips(mine, [{ id: 'a', destination: 'Lisboa', startDate: '2026-12-12', endDate: '2026-12-16', lat: 38.71, lng: -9.14 }])
    expect(r).toHaveLength(1)
    expect(r[0].overlapDays).toBe(3)
  })
  it('includes trips up to 5 days apart, excludes 6', () => {
    const near = { id: 'b', destination: 'Lisbon', startDate: '2026-12-19', endDate: '2026-12-21', ...lisbon } // 5 apart
    const far = { id: 'c', destination: 'Lisbon', startDate: '2026-12-20', endDate: '2026-12-22', ...lisbon } // 6 apart
    const r = matchTrips(mine, [near, far])
    expect(r.map((m) => m.trip.id)).toEqual(['b'])
    expect(r[0].gapDays).toBe(5)
  })
  it('excludes other cities and my own trip', () => {
    const porto = { id: 'd', destination: 'Porto', startDate: '2026-12-10', endDate: '2026-12-12', lat: 41.15, lng: -8.61 }
    expect(matchTrips(mine, [porto, { ...mine }])).toHaveLength(0)
  })
  it('falls back to destination name without coordinates', () => {
    const r = matchTrips({ destination: 'Shillong', startDate: '2026-12-01', endDate: '2026-12-03' }, [
      { id: 'e', destination: 'shillong, Meghalaya', startDate: '2026-12-02', endDate: '2026-12-05' },
    ])
    expect(r).toHaveLength(1)
  })
  it('sorts by overlap first', () => {
    const r = matchTrips(mine, [
      { id: 'x', destination: 'Lisbon', startDate: '2026-12-16', endDate: '2026-12-18', ...lisbon },
      { id: 'y', destination: 'Lisbon', startDate: '2026-12-09', endDate: '2026-12-15', ...lisbon },
    ])
    expect(r.map((m) => m.trip.id)).toEqual(['y', 'x'])
  })
})

describe('dateRelation', () => {
  it('reports adjacent ranges as 1 day apart', () => {
    expect(dateRelation(mine, { destination: '', startDate: '2026-12-15', endDate: '2026-12-16' })).toEqual({ overlapDays: 0, gapDays: 1 })
  })
})
