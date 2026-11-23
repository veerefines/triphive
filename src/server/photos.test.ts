import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { isAllowedPhotoUrl, photoKey, placePhotos } from './photos'

type Row = { recordId: string; data: Record<string, unknown> }

/** In-memory store: place_photos + ai_usage, matched on every where-field. */
function fakeTools() {
  const tables: Record<string, Row[]> = {}
  const rows = (c: string) => (tables[c] ??= [])
  const tools = {
    query: async (c: string, q: { where: Record<string, unknown> }) => ({
      success: true,
      data: { records: rows(c).filter((r) => Object.entries(q.where).every(([k, v]) => r.data[k] === v)).map((r) => ({ ...r, data: { ...r.data } })) },
    }),
    create: async (c: string, data: Record<string, unknown>) => {
      rows(c).push({ recordId: `${c}${rows(c).length}`, data: { ...data } })
      return { success: true }
    },
    update: async (c: string, id: string, patch: Record<string, unknown>) => {
      const i = rows(c).findIndex((r) => r.recordId === id)
      rows(c)[i] = { ...rows(c)[i], data: { ...rows(c)[i].data, ...patch } }
      return { success: true }
    },
  }
  return { tools: tools as unknown as ActionTools, tables }
}

const WIKI_IMG = 'https://upload.wikimedia.org/a/belem.jpg'
function mockWikipedia() {
  const fetchMock = vi.fn(async (url: string) =>
    new Response(JSON.stringify({ query: { pages: { '1': { index: 1, thumbnail: { source: WIKI_IMG } }, '2': { index: 2, thumbnail: { source: 'https://evil.example/x.jpg' } } } } }), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('photoKey', () => {
  test('normalizes case, accents and punctuation', () => {
    expect(photoKey({ q: 'Torre de Belém!', near: 'Lisbon' })).toBe(photoKey({ q: 'torre de belem', near: 'LISBON' }))
  })
  test('location bias is part of the key, rounded to ~11 km', () => {
    const lisbon = photoKey({ q: 'Cafe Central', lat: 38.72, lng: -9.14 })
    expect(photoKey({ q: 'Cafe Central', lat: 38.74, lng: -9.13 })).toBe(lisbon)
    expect(photoKey({ q: 'Cafe Central', lat: 48.21, lng: 16.37 })).not.toBe(lisbon)
    expect(photoKey({ q: 'Cafe Central' })).not.toBe(lisbon)
  })
  test('max is part of the key', () => {
    expect(photoKey({ q: 'x y', max: 4 })).not.toBe(photoKey({ q: 'x y', max: 1 }))
  })
})

describe('isAllowedPhotoUrl', () => {
  test('accepts only https Google photo CDN and Wikimedia', () => {
    expect(isAllowedPhotoUrl('https://lh3.googleusercontent.com/p/abc')).toBe(true)
    expect(isAllowedPhotoUrl(WIKI_IMG)).toBe(true)
    expect(isAllowedPhotoUrl('http://upload.wikimedia.org/a.jpg')).toBe(false)
    expect(isAllowedPhotoUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedPhotoUrl('https://googleusercontent.com.evil.io/a')).toBe(false)
  })
})

describe('placePhotos', () => {
  test('falls back to Wikipedia without a Google key and drops foreign hosts', async () => {
    const { tools } = fakeTools()
    mockWikipedia()
    const r = await placePhotos(tools, 'u1', undefined, { queries: [{ q: 'Belem Tower', near: 'Lisbon', max: 4 }] })
    expect(r.photos).toEqual([[WIKI_IMG]])
  })

  test('second call is served from the cache without fetching', async () => {
    const { tools } = fakeTools()
    const fetchMock = mockWikipedia()
    await placePhotos(tools, 'u1', undefined, { queries: [{ q: 'Belem Tower' }] })
    const calls = fetchMock.mock.calls.length
    const again = await placePhotos(tools, 'u2', undefined, { queries: [{ q: 'belem tower' }] })
    expect(again.photos).toEqual([[WIKI_IMG]])
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  test('rejects malformed requests', async () => {
    const { tools } = fakeTools()
    await expect(placePhotos(tools, 'u1', undefined, { queries: [] })).rejects.toThrow('Bad photo request')
    await expect(placePhotos(tools, 'u1', undefined, { queries: Array(17).fill({ q: 'ok ok' }) })).rejects.toThrow('Bad photo request')
  })

  test('an invalid query yields an empty list without failing its batch', async () => {
    const { tools } = fakeTools()
    mockWikipedia()
    const r = await placePhotos(tools, 'u1', undefined, { queries: [{ q: 'x' }, { q: 'Belem Tower', lat: null }] })
    expect(r.photos).toEqual([[], [WIKI_IMG]])
  })

  test('a batch reserves all its misses in one call and dedupes repeated queries', async () => {
    const { tools, tables } = fakeTools()
    mockWikipedia()
    await placePhotos(tools, 'u1', undefined, { queries: [{ q: 'Belem Tower' }, { q: 'belem tower' }, { q: 'Jeronimos Monastery' }] })
    const userRow = tables.ai_usage.find((r) => r.data.userId === 'u1')
    expect(userRow?.data.count).toBe(2)
  })

  test('denied budget serves no new lookups', async () => {
    const { tools, tables } = fakeTools()
    const fetchMock = mockWikipedia()
    const day = new Date().toISOString().slice(0, 10)
    tables.ai_usage = [{ recordId: 'x', data: { userId: 'u1', day: `photos-user:${day}`, count: 200 } }]
    const r = await placePhotos(tools, 'u1', undefined, { queries: [{ q: 'Belem Tower' }] })
    expect(r.photos).toEqual([[]])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
