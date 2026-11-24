import { describe, expect, it } from 'vitest'
import { hiddenProfilesFor } from './profileAccess'

const row = (userId: string, isPublic: number, extra: Record<string, unknown> = {}) => ({ userId, displayName: userId, isPublic, ...extra })

describe('hiddenProfilesFor', () => {
  it('returns only hidden profiles of connected users', () => {
    // Arrange
    const rows = [row('friend', 0), row('stranger', 0), row('listed', 1)]

    // Act
    const out = hiddenProfilesFor(rows, ['friend', 'listed'])

    // Assert
    expect(out.map((p) => p.userId)).toEqual(['friend'])
  })

  it('returns nothing when the caller has no connections', () => {
    expect(hiddenProfilesFor([row('a', 0)], [])).toEqual([])
  })

  it('copies only display fields, never internal columns', () => {
    const [p] = hiddenProfilesFor([row('friend', 0, { bio: 'hi', secretNote: 'x' })], ['friend'])
    expect(p).toMatchObject({ userId: 'friend', bio: 'hi' })
    expect(p).not.toHaveProperty('secretNote')
  })
})
