import { describe, expect, it } from 'vitest'
import { createProfileCache, rowsFor } from './useConnectedProfiles'
import type { Profile } from './index'

const p = (userId: string) => ({ userId }) as Profile

/** A fetcher whose calls resolve or reject only when the test says so. */
function controlledFetch() {
  const pending: { resolve: (r: Profile[]) => void; reject: (e: Error) => void }[] = []
  const fetch = () => new Promise<Profile[]>((resolve, reject) => pending.push({ resolve, reject }))
  return { fetch, pending }
}

describe('createProfileCache', () => {
  it('shares one in-flight request between concurrent callers', async () => {
    // Arrange
    const { fetch, pending } = controlledFetch()
    const cache = createProfileCache(fetch, () => 0)

    // Act
    const a = cache.load('me')
    const b = cache.load('me')
    pending[0].resolve([p('mate')])

    // Assert
    expect(pending).toHaveLength(1)
    expect(await a).toEqual([p('mate')])
    expect(await b).toEqual([p('mate')])
  })

  it('serves cached rows until the refresh window passes', async () => {
    let now = 0
    const { fetch, pending } = controlledFetch()
    const cache = createProfileCache(fetch, () => now)
    const first = cache.load('me')
    pending[0].resolve([p('mate')])
    await first

    now = 59_999
    expect(await cache.load('me')).toEqual([p('mate')])
    expect(pending).toHaveLength(1)

    now = 60_000
    void cache.load('me')
    expect(pending).toHaveLength(2)
  })

  it('keeps the last good rows when a refresh fails', async () => {
    let now = 0
    const { fetch, pending } = controlledFetch()
    const cache = createProfileCache(fetch, () => now)
    const first = cache.load('me')
    pending[0].resolve([p('mate')])
    await first

    now = 60_000
    const retry = cache.load('me')
    pending[1].reject(new Error('offline'))

    expect(await retry).toEqual([p('mate')])
  })

  it('never shares one user’s rows with another user', async () => {
    const { fetch, pending } = controlledFetch()
    const cache = createProfileCache(fetch, () => 0)
    const mine = cache.load('me')
    pending[0].resolve([p('mate')])
    await mine

    void cache.load('someone-else')

    expect(pending).toHaveLength(2)
  })

  it('forgets everything on clear', async () => {
    const { fetch, pending } = controlledFetch()
    const cache = createProfileCache(fetch, () => 0)
    const mine = cache.load('me')
    pending[0].resolve([p('mate')])
    await mine

    cache.clear()
    void cache.load('me')

    expect(pending).toHaveLength(2)
  })
})

describe('rowsFor', () => {
  const state = { owner: 'me', rows: [p('mate')] }

  it('returns rows fetched for the signed-in user', () => {
    expect(rowsFor(state, 'me')).toEqual([p('mate')])
  })

  it('returns nothing for a different user or when signed out', () => {
    expect(rowsFor(state, 'someone-else')).toEqual([])
    expect(rowsFor(state, null)).toEqual([])
    expect(rowsFor(state, undefined)).toEqual([])
  })
})
