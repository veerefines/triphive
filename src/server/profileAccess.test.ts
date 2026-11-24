import { describe, expect, it } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { connectedProfiles, connectionsOf, hiddenProfilesFor } from './profileAccess'

const row = (userId: string, isPublic: number, extra: Record<string, unknown> = {}) => ({ userId, displayName: userId, isPublic, ...extra })

describe('hiddenProfilesFor', () => {
  it('returns only hidden profiles of connected users', () => {
    // Arrange
    const rows = [row('friend', 0), row('stranger', 0), row('listed', 1)]

    // Act
    const out = hiddenProfilesFor(rows, ['friend', 'listed'])

    // Assert
    expect(out.map((p) => p.userId)).toEqual(['friend'])
  })

  it('returns nothing when the caller has no connections', () => {
    expect(hiddenProfilesFor([row('a', 0)], [])).toEqual([])
  })

  it('copies only display fields, never internal columns', () => {
    const [p] = hiddenProfilesFor([row('friend', 0, { bio: 'hi', secretNote: 'x' })], ['friend'])
    expect(p).toMatchObject({ userId: 'friend', bio: 'hi' })
    expect(p).not.toHaveProperty('secretNote')
  })
})

type Row = Record<string, unknown>

/** In-memory collections; `query` matches every `where` field by equality. */
function fakeTools(collections: Record<string, Row[]>): ActionTools {
  const query = async (name: string, q: { where?: Row }) => ({
    success: true,
    data: {
      records: (collections[name] ?? [])
        .filter((r) => Object.entries(q.where ?? {}).every(([k, v]) => r[k] === v))
        .map((data, i) => ({ recordId: `${name}-${i}`, data: { ...data } })),
    },
  })
  return { query } as unknown as ActionTools
}

const member = (teamId: string, userId: string, status = 'active') => ({ teamId, userId, status, role: 'member' })

describe('connectionsOf', () => {
  it('includes active co-members and skips trips the caller left', async () => {
    // Arrange
    const tools = fakeTools({
      team_members: [member('t1', 'me'), member('t1', 'ana'), member('t1', 'gone', 'left'), member('t2', 'me', 'left'), member('t2', 'bo')],
    })

    // Act
    const out = await connectionsOf(tools, 'me')

    // Assert
    expect(out.sort()).toEqual(['ana'])
  })

  it('counts join requests in both directions and never includes the caller', async () => {
    const tools = fakeTools({
      join_requests: [
        { requesterId: 'me', ownerId: 'host' },
        { requesterId: 'asker', ownerId: 'me' },
      ],
    })

    expect((await connectionsOf(tools, 'me')).sort()).toEqual(['asker', 'host'])
  })
})

describe('connectedProfiles', () => {
  it('returns hidden profiles of connections only, not strangers or listed travelers', async () => {
    const tools = fakeTools({
      team_members: [member('t1', 'me'), member('t1', 'mate'), member('t1', 'listed')],
      profiles: [row('mate', 0, { bio: 'hi', secretNote: 'x' }), row('listed', 1), row('stranger', 0)],
    })

    const out = await connectedProfiles(tools, 'me')

    expect(out).toEqual([{ userId: 'mate', displayName: 'mate', isPublic: 0, bio: 'hi' }])
  })

  it('returns nothing without connections', async () => {
    expect(await connectedProfiles(fakeTools({ profiles: [row('stranger', 0)] }), 'me')).toEqual([])
  })
})
