/**
 * Hidden profiles of the signed-in traveler's trip-mates and join-request
 * counterparts. `profiles` only syncs the caller's own row and listed (public)
 * rows, so these come from the connectedProfiles action instead.
 *
 * One shared module cache serves every avatar on the page: concurrent callers
 * share a request, and results stay fresh for REFRESH_MS.
 */
import { useEffect, useState } from 'react'
import { callAction } from '@/lib/api'
import type { Profile } from './index'

const REFRESH_MS = 60_000

let cached: Profile[] = []
let fetchedAt = 0
let inflight: Promise<Profile[]> | null = null

function load(): Promise<Profile[]> {
  if (Date.now() - fetchedAt < REFRESH_MS) return Promise.resolve(cached)
  inflight ??= callAction<Profile[]>('connectedProfiles', {})
    .then((rows) => {
      cached = Array.isArray(rows) ? rows : []
      fetchedAt = Date.now()
      return cached
    })
    // A failed fetch keeps the last good list; hidden profiles then fall back
    // to account names and the default avatar until the next refresh.
    .catch(() => cached)
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useConnectedProfiles(enabled: boolean): Profile[] {
  const [rows, setRows] = useState<Profile[]>(cached)
  useEffect(() => {
    if (!enabled) return
    let live = true
    void load().then((r) => live && setRows(r))
    return () => {
      live = false
    }
  }, [enabled])
  return enabled ? rows : []
}
