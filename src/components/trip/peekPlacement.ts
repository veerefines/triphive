/** Where the map peek card sits relative to a pin, kept inside the map box. */
export const PEEK_WIDTH = 300
export const PEEK_HEIGHT = 380
const GAP = 22
const EDGE = 8

export interface PeekPlacement {
  left: number
  top: number
  /** True when the card hangs below the pin (not enough room above). */
  isBelow: boolean
}

export function placePeek(pin: { x: number; y: number }, box: { width: number; height: number }): PeekPlacement {
  const maxLeft = Math.max(EDGE, box.width - PEEK_WIDTH - EDGE)
  const left = Math.min(maxLeft, Math.max(EDGE, pin.x - PEEK_WIDTH / 2))
  const isBelow = pin.y - GAP - PEEK_HEIGHT < EDGE
  const rawTop = isBelow ? pin.y + GAP : pin.y - GAP - PEEK_HEIGHT
  const top = Math.max(EDGE, Math.min(rawTop, box.height - PEEK_HEIGHT - EDGE))
  return { left, top, isBelow }
}
