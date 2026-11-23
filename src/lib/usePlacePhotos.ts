/**
 * Place photos on the client. Every component asks for its own place; calls
 * made in the same tick are batched into one `placePhotos` action (max 16
 * per request) and results are memoized for the session, so a Board with 20
 * stops costs two requests and remounts cost none.
 */
import { useEffect, useState } from 'react'
import type { PhotoQuery } from '@/server/photos'
import { callAction } from './api'

const BATCH_SIZE = 16
const cache = new Map<string, Promise<string[]>>()
let queue: Array<{ query: PhotoQuery; resolve: (urls: string[]) => void }> = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function keyOf(q: PhotoQuery): string {
  return JSON.stringify([q.q.trim().toLowerCase(), (q.near ?? '').trim().toLowerCase(), q.max ?? 1])
}

async function sendBatch(batch: typeof queue): Promise<void> {
  try {
    const { photos } = await callAction<{ photos: string[][] }>('placePhotos', { queries: batch.map((b) => b.query) })
    batch.forEach((b, i) => b.resolve(photos[i] ?? []))
  } catch (err) {
    console.warn('[photos] lookup failed', err)
    batch.forEach((b) => b.resolve([]))
  }
}

function flush(): void {
  flushTimer = null
  const pending = queue
  queue = []
  for (let i = 0; i < pending.length; i += BATCH_SIZE) void sendBatch(pending.slice(i, i + BATCH_SIZE))
}

export function fetchPlacePhotos(query: PhotoQuery): Promise<string[]> {
  const key = keyOf(query)
  const hit = cache.get(key)
  if (hit) return hit
  const promise = new Promise<string[]>((resolve) => {
    queue = [...queue, { query, resolve }]
    flushTimer ??= setTimeout(flush, 0)
  })
  cache.set(key, promise)
  return promise
}

type PhotoState = { urls: string[]; isLoading: boolean }

/** Photos for one place; pass null to skip (e.g. a name too short to search). */
export function usePlacePhotos(query: PhotoQuery | null): PhotoState {
  const key = query && query.q.trim().length >= 2 ? keyOf(query) : null
  const [state, setState] = useState<PhotoState & { key: string | null }>({ urls: [], isLoading: !!key, key })

  useEffect(() => {
    if (!key || !query) return
    let isActive = true
    fetchPlacePhotos(query).then((urls) => {
      if (isActive) setState({ urls, isLoading: false, key })
    })
    return () => {
      isActive = false
    }
    // `key` captures every field of `query` that matters.
  }, [key])

  if (state.key !== key) return { urls: [], isLoading: !!key }
  return { urls: state.urls, isLoading: state.isLoading }
}
