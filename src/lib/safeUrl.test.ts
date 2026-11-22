import { describe, expect, it } from 'vitest'
import { safeHref } from './safeUrl'

describe('safeHref', () => {
  it('allows http(s)', () => {
    expect(safeHref('https://maps.google.com/?q=1')).toBe('https://maps.google.com/?q=1')
    expect(safeHref('http://example.com')).toBe('http://example.com/')
  })
  it('blocks script and data schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref(' JAVASCRIPT:alert(1)')).toBeUndefined()
    expect(safeHref('data:text/html,<script>1</script>')).toBeUndefined()
  })
  it('handles junk', () => {
    expect(safeHref('not a url')).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})
