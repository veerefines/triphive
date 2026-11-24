import { describe, expect, it } from 'vitest'
import { MAX_VIEWERS, mergeViewers } from './profileViewers'

describe('mergeViewers', () => {
  it('adds new ids once and never lists the profile owner', () => {
    // Arrange
    const current = ['a', 'b']

    // Act
    const next = mergeViewers(current, ['b', 'c', 'me'], 'me')

    // Assert
    expect(next).toEqual(['a', 'b', 'c'])
  })

  it('treats a missing or malformed list as empty', () => {
    expect(mergeViewers(undefined, ['x'], 'me')).toEqual(['x'])
    expect(mergeViewers('nope', ['x'], 'me')).toEqual(['x'])
    expect(mergeViewers([1, 'y', null], ['x'], 'me')).toEqual(['y', 'x'])
  })

  it('does not mutate the stored list', () => {
    const current = Object.freeze(['a'])
    expect(() => mergeViewers(current, ['b'], 'me')).not.toThrow()
    expect(current).toEqual(['a'])
  })

  it('keeps the most recent connections when the cap is reached', () => {
    const current = Array.from({ length: MAX_VIEWERS }, (_, i) => `u${i}`)
    const next = mergeViewers(current, ['newest'], 'me')
    expect(next).toHaveLength(MAX_VIEWERS)
    expect(next.at(-1)).toBe('newest')
    expect(next).not.toContain('u0')
  })
})
