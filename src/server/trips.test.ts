import { describe, expect, it, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { addStopOnce, isSameStop } from './trips'

function fakeTools(existing: Array<{ title: string; date: string }>) {
  const create = vi.fn(async () => ({ success: true, data: { recordId: 'new_1' } }))
  const query = vi.fn(async () => ({
    success: true,
    data: { records: existing.map((d, i) => ({ recordId: `s_${i}`, data: d })) },
  }))
  return { tools: { create, query } as unknown as ActionTools, create }
}

describe('isSameStop', () => {
  it('matches the same place regardless of case and accents', () => {
    expect(isSameStop({ title: 'Café Brasileira', date: '2026-12-27' }, { title: 'cafe brasileira', date: '2026-12-27' })).toBe(true)
  })
  it('does not match the same place on another day', () => {
    expect(isSameStop({ title: 'Root Bridge', date: '2026-12-27' }, { title: 'Root Bridge', date: '2026-12-28' })).toBe(false)
  })
})

describe('addStopOnce', () => {
  it('returns the existing stop instead of creating a duplicate', async () => {
    const { tools, create } = fakeTools([{ title: 'Double Decker Living Root Bridge', date: '2026-12-27' }])
    const r = await addStopOnce(tools, 'trip_1', { title: 'Double Decker Living Root Bridge', date: '2026-12-27' }, 'ai')
    expect(r).toEqual({ stopId: 's_0', isDuplicate: true })
    expect(create).not.toHaveBeenCalled()
  })
  it('creates the stop when the day has no twin', async () => {
    const { tools, create } = fakeTools([{ title: 'Nohkalikai Falls', date: '2026-12-27' }])
    const r = await addStopOnce(tools, 'trip_1', { title: 'Double Decker Living Root Bridge', date: '2026-12-27' }, 'human')
    expect(r).toEqual({ stopId: 'new_1', isDuplicate: false })
    expect(create).toHaveBeenCalledOnce()
  })
})
