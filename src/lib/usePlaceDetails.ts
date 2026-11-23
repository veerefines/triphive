/**
 * Google place details (reviews, summary, hours) for one place, memoized for
 * the session so re-hovering a pin costs nothing. Pass null to skip.
 */
import { useEffect, useState } from 'react'
import type { PlaceDetails } from '@/server/placeDetails'
import { callAction } from './api'

export type PlaceDetailsQuery = { name: string; destination?: string; lat?: number; lng?: number }
type DetailsState = { details: PlaceDetails | null; isLoading: boolean }

const cache = new Map<string, Promise<PlaceDetails | null>>()

function keyOf(q: PlaceDetailsQuery): string {
  return JSON.stringify([q.name.trim().toLowerCase(), (q.destination ?? '').trim().toLowerCase()])
}

function fetchPlaceDetails(q: PlaceDetailsQuery): Promise<PlaceDetails | null> {
  const key = keyOf(q)
  const hit = cache.get(key)
  if (hit) return hit
  const promise = callAction<{ details: PlaceDetails | null }>('placeDetails', {
    name: q.name.trim().slice(0, 120),
    destination: q.destination?.slice(0, 160),
    lat: Number.isFinite(q.lat) ? q.lat : undefined,
    lng: Number.isFinite(q.lng) ? q.lng : undefined,
  })
    .then((r) => r.details)
    .catch((err) => {
      console.warn('[placeDetails] lookup failed', err)
      cache.delete(key) // let a later open retry
      return null
    })
  cache.set(key, promise)
  return promise
}

export function usePlaceDetails(query: PlaceDetailsQuery | null): DetailsState {
  const key = query && query.name.trim().length >= 2 ? keyOf(query) : null
  const [state, setState] = useState<DetailsState & { key: string | null }>({ details: null, isLoading: !!key, key })

  useEffect(() => {
    if (!key || !query) return
    let isActive = true
    fetchPlaceDetails(query).then((details) => {
      if (isActive) setState({ details, isLoading: false, key })
    })
    return () => {
      isActive = false
    }
  }, [key])

  if (state.key !== key) return { details: null, isLoading: !!key }
  return { details: state.details, isLoading: state.isLoading }
}
