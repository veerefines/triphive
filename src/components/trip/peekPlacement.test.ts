import { describe, expect, test } from 'vitest'
import { PEEK_HEIGHT, PEEK_WIDTH, placePeek } from './peekPlacement'

const box = { width: 900, height: 700 }

describe('placePeek', () => {
  test('centres the card above a pin with room above', () => {
    const p = placePeek({ x: 450, y: 600 }, box)
    expect(p.isBelow).toBe(false)
    expect(p.left).toBe(450 - PEEK_WIDTH / 2)
    expect(p.top + PEEK_HEIGHT).toBeLessThan(600)
  })

  test('flips below a pin near the top edge', () => {
    const p = placePeek({ x: 450, y: 60 }, box)
    expect(p.isBelow).toBe(true)
    expect(p.top).toBeGreaterThan(60)
  })

  test('clamps horizontally inside the map', () => {
    expect(placePeek({ x: 5, y: 600 }, box).left).toBe(8)
    expect(placePeek({ x: 895, y: 600 }, box).left).toBe(900 - PEEK_WIDTH - 8)
  })

  test('stays inside a map shorter than the card', () => {
    const p = placePeek({ x: 200, y: 200 }, { width: 400, height: 360 })
    expect(p.top).toBeGreaterThanOrEqual(8)
  })
})
