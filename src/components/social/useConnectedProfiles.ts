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

type Entry = { rows: Profile[]; fetchedAt: number | null; inflight: Promise<Profile[]> | null }
type Owned = { owner: string; rows: Profile[] }

export type ProfileCache = { load: (userId: string) => Promise<Profile[]>; clear: () => void }

/**
 * Per-user cache around `fetchRows`. Keyed by the signed-in user id so one
 * account never sees another's connections after a sign-out and sign-in in
 * the same tab.
 */
export function createProfileCache(fetchRows: () => Promise<Profile[]>, now: () => number = Date.now): ProfileCache {
  const entries = new Map<string, Entry>()

  function load(userId: string): Promise<Profile[]> {
    const entry = entries.get(userId) ?? { rows: [], fetchedAt: null, inflight: null }
    if (entry.fetchedAt !== null && now() - entry.fetchedAt < REFRESH_MS) return Promise.resolve(entry.rows)
    if (entry.inflight) return entry.inflight
    const inflight = fetchRows()
      .then((rows) => {
        const fresh = Array.isArray(rows) ? rows : []
        entries.set(userId, { rows: fresh, fetchedAt: now(), inflight: null })
        return fresh
      })
      // A failed fetch keeps this user's last good list; hidden profiles then fall
      // back to account names and the default avatar until the next refresh.
      .catch(() => {
        entries.set(userId, { ...entry, inflight: null })
        return entry.rows
      })
    entries.set(userId, { ...entry, inflight })
    return inflight
  }

  return { load, clear: () => entries.clear() }
}

/** Rows only when they were fetched for the user who is signed in now. */
export function rowsFor(state: Owned, userId: string | null | undefined): Profile[] {
  return userId && state.owner === userId ? state.rows : []
}

const cache = createProfileCache(() => callAction<Profile[]>('connectedProfiles', {}))

/** Connected hidden profiles for `userId`; empty when signed out. */
export function useConnectedProfiles(userId: string | null | undefined): Profile[] {
  const [state, setState] = useState<Owned>({ owner: '', rows: [] })
  useEffect(() => {
    if (!userId) {
      cache.clear()
      return
    }
    let live = true
    void cache.load(userId).then((rows) => live && setState({ owner: userId, rows }))
    return () => {
      live = false
    }
  }, [userId])
  // Never return rows fetched for a different identity.
  return rowsFor(state, userId)
}
