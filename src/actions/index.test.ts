import { describe, expect, it } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { actions } from './index'

type Ctx = Parameters<(typeof actions)[string]>[0]

/** Queries return a trip-mate with a hidden profile, so the action has something to share. */
function ctxFor(userId: string): Ctx {
  const rows: Record<string, Record<string, unknown>[]> = {
    team_members: [
      { teamId: 't1', userId: 'me', status: 'active' },
      { teamId: 't1', userId: 'mate', status: 'active' },
    ],
    profiles: [{ userId: 'mate', displayName: 'Mate', isPublic: 0 }],
  }
  const query = async (name: string, q: { where?: Record<string, unknown> }) => ({
    success: true,
    data: {
      records: (rows[name] ?? [])
        .filter((r) => Object.entries(q.where ?? {}).every(([k, v]) => r[k] === v))
        .map((data, i) => ({ recordId: `${name}-${i}`, data })),
    },
  })
  return { userId, params: {}, tools: { query } as unknown as ActionTools } as unknown as Ctx
}

describe('connectedProfiles action', () => {
  it('is registered and scopes results to the signed-in caller', async () => {
    // Act
    const mine = await actions.connectedProfiles(ctxFor('me'))
    const outsider = await actions.connectedProfiles(ctxFor('outsider'))

    // Assert
    expect(mine).toEqual({ success: true, data: [{ userId: 'mate', displayName: 'Mate', isPublic: 0 }] })
    expect(outsider).toEqual({ success: true, data: [] })
  })

  it('ignores a userId smuggled in through params', async () => {
    const ctx = { ...ctxFor('outsider'), params: { userId: 'me' } } as Ctx

    expect(await actions.connectedProfiles(ctx)).toEqual({ success: true, data: [] })
  })
})
