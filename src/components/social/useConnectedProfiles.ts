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

type Entry = { rows: Profile[]; fetchedAt: number; inflight: Promise<Profile[]> | null }

// Keyed by the signed-in user id so one account never sees another's
// connections after a sign-out and sign-in in the same tab.
const cache = new Map<string, Entry>()

function load(userId: string): Promise<Profile[]> {
  const entry = cache.get(userId) ?? { rows: [], fetchedAt: 0, inflight: null }
  if (Date.now() - entry.fetchedAt < REFRESH_MS) return Promise.resolve(entry.rows)
  if (entry.inflight) return entry.inflight
  const inflight = callAction<Profile[]>('connectedProfiles', {})
    .then((rows) => {
      const fresh = Array.isArray(rows) ? rows : []
      cache.set(userId, { rows: fresh, fetchedAt: Date.now(), inflight: null })
      return fresh
    })
    // A failed fetch keeps this user's last good list; hidden profiles then fall
    // back to account names and the default avatar until the next refresh.
    .catch(() => {
      cache.set(userId, { ...entry, inflight: null })
      return entry.rows
    })
  cache.set(userId, { ...entry, inflight })
  return inflight
}

/** Connected hidden profiles for `userId`; empty when signed out. */
export function useConnectedProfiles(userId: string | null | undefined): Profile[] {
  const [state, setState] = useState<{ owner: string; rows: Profile[] }>({ owner: '', rows: [] })
  useEffect(() => {
    if (!userId) {
      cache.clear()
      return
    }
    let live = true
    void load(userId).then((rows) => live && setState({ owner: userId, rows }))
    return () => {
      live = false
    }
  }, [userId])
  // Never return rows fetched for a different identity.
  return userId && state.owner === userId ? state.rows : []
}
