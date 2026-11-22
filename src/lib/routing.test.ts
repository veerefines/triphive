import { describe, expect, test } from 'vitest'
import { parseOsrm } from './routing'

describe('parseOsrm', () => {
  test('flips lng,lat to lat,lng and converts units', () => {
    const r = parseOsrm({ code: 'Ok', routes: [{ geometry: { coordinates: [[-9.14, 38.72], [-9.13, 38.71]] }, duration: 610, distance: 1234 }] })
    expect(r).toEqual({ path: [[38.72, -9.14], [38.71, -9.13]], minutes: 10, km: 1.23 })
  })

  test('returns null for errors and malformed payloads', () => {
    expect(parseOsrm({ code: 'NoRoute', routes: [] })).toBeNull()
    expect(parseOsrm(null)).toBeNull()
    expect(parseOsrm({ routes: [{ geometry: { coordinates: [[1, 2]] }, duration: 1, distance: 1 }] })).toBeNull()
  })
})
