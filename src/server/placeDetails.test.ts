import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { detailsKey, parseGooglePlace, placeDetails, safeWebUrl } from './placeDetails'

type Row = { recordId: string; data: Record<string, unknown> }

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

const GOOGLE_PLACE = {
  displayName: { text: 'Time Out Market' },
  formattedAddress: 'Av. 24 de Julho 49, Lisboa',
  rating: 4.5,
  userRatingCount: 61234,
  websiteUri: 'https://www.timeoutmarket.com/lisboa/',
  googleMapsUri: 'https://maps.google.com/?cid=1',
  editorialSummary: { text: 'Food hall with   top chefs.' },
  currentOpeningHours: { openNow: true },
  regularOpeningHours: { weekdayDescriptions: ['Monday: 10:00 AM – 12:00 AM'] },
  reviews: [
    { rating: 5, text: { text: 'Great pastries' }, relativePublishTimeDescription: '2 weeks ago', authorAttribution: { displayName: 'Ana' } },
    { rating: 4, text: { text: '' } },
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('safeWebUrl', () => {
  test('keeps http(s) and drops other schemes', () => {
    expect(safeWebUrl('https://a.example/x')).toBe('https://a.example/x')
    expect(safeWebUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeWebUrl('not a url')).toBeUndefined()
    expect(safeWebUrl(42)).toBeUndefined()
  })
})

describe('parseGooglePlace', () => {
  test('maps fields, collapses whitespace and drops empty reviews', () => {
    const d = parseGooglePlace(GOOGLE_PLACE, 'fallback')
    expect(d.name).toBe('Time Out Market')
    expect(d.summary).toBe('Food hall with top chefs.')
    expect(d.openNow).toBe(true)
    expect(d.hours).toEqual(['Monday: 10:00 AM – 12:00 AM'])
    expect(d.reviews).toEqual([{ author: 'Ana', rating: 5, text: 'Great pastries', when: '2 weeks ago' }])
  })

  test('tolerates junk input', () => {
    const d = parseGooglePlace({ reviews: 'nope', websiteUri: 'javascript:x', rating: 'high' } as never, 'Belém Tower')
    expect(d).toMatchObject({ name: 'Belém Tower', hours: [], reviews: [], website: undefined, rating: undefined })
  })
})

describe('placeDetails action', () => {
  test('returns null without a Google key and does not call out', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { tools } = fakeTools()
    expect(await placeDetails(tools, 'u1', undefined, { name: 'Time Out Market', destination: 'Lisbon, Portugal' })).toEqual({ details: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('caches a Google lookup so the second call is free', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ places: [GOOGLE_PLACE] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tools, tables } = fakeTools()
    const params = { name: 'Time Out Market', destination: 'Lisbon, Portugal' }
    const first = await placeDetails(tools, 'u1', 'key', params)
    const second = await placeDetails(tools, 'u1', 'key', params)
    expect(first.details?.rating).toBe(4.5)
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(tables.place_details).toHaveLength(1)
  })

  test('refunds the budget when Google fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })))
    const { tools, tables } = fakeTools()
    expect(await placeDetails(tools, 'u1', 'key', { name: 'Somewhere' })).toEqual({ details: null })
    const usage = (tables.ai_usage ?? []).reduce((s, r) => s + Number(r.data.count ?? 0), 0)
    expect(usage).toBe(0)
  })

  test('rejects bad params', async () => {
    const { tools } = fakeTools()
    await expect(placeDetails(tools, 'u1', 'key', { name: '' })).rejects.toThrow('Bad place request')
  })
})

describe('detailsKey', () => {
  test('location bias is part of the key, rounded to ~11 km', () => {
    const lisbon = detailsKey({ name: 'Cafe Central', destination: 'Lisbon', lat: 38.72, lng: -9.14 })
    expect(detailsKey({ name: 'cafe central', destination: 'LISBON', lat: 38.74, lng: -9.13 })).toBe(lisbon)
    expect(detailsKey({ name: 'Cafe Central', destination: 'Lisbon', lat: 48.21, lng: 16.37 })).not.toBe(lisbon)
    expect(detailsKey({ name: 'Cafe Central', destination: 'Lisbon' })).not.toBe(lisbon)
  })
})

describe('placeDetails request', () => {
  test('sends Google only the parts that make up the cache key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ places: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { tools } = fakeTools()
    await placeDetails(tools, 'u1', 'k', { name: 'Café Central', destination: 'Lisbon, Texas', lat: 38.7234, lng: -9.1411 })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.textQuery).toBe('cafe central, lisbon')
    expect(body.locationBias.circle.center).toEqual({ latitude: 38.7, longitude: -9.1 })
  })
  test('skips names that fold to nothing instead of sharing one cache row', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { tools } = fakeTools()
    expect(await placeDetails(tools, 'u1', 'k', { name: '東京タワー', destination: 'Tokyo' })).toEqual({ details: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
