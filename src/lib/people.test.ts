import { describe, expect, it } from 'vitest'
import { filterPeople, isPublicProfile } from './people'

const priya = { userId: 'p', displayName: 'Priya Sharma', homeCity: 'Mumbai', travelStyle: 'Foodie', interests: ['Street food', 'Markets'], isPublic: 1 }
const marco = { userId: 'm', displayName: 'Marco Rossi', homeCity: 'Milan', travelStyle: 'Planner', interests: ['Photography'], isPublic: true }
const hidden = { userId: 'h', displayName: 'Hidden Hana', homeCity: 'Osaka', interests: [], isPublic: 0 }

describe('isPublicProfile', () => {
  it('accepts 1 and true and rejects everything else', () => {
    expect(isPublicProfile(priya)).toBe(true)
    expect(isPublicProfile(marco)).toBe(true)
    expect(isPublicProfile(hidden)).toBe(false)
    expect(isPublicProfile({})).toBe(false)
  })
})

describe('filterPeople', () => {
  const all = [priya, marco, hidden]

  it('returns only public profiles, excluding me', () => {
    expect(filterPeople(all, { me: 'p' }).map((p) => p.userId)).toEqual(['m'])
  })

  it('matches the query against name, city, bio and interests, ignoring case', () => {
    expect(filterPeople(all, { query: 'milan' }).map((p) => p.userId)).toEqual(['m'])
    expect(filterPeople(all, { query: 'street' }).map((p) => p.userId)).toEqual(['p'])
  })

  it('filters by interest', () => {
    expect(filterPeople(all, { interest: 'Photography' }).map((p) => p.userId)).toEqual(['m'])
  })

  it('returns nothing when no public profile matches', () => {
    expect(filterPeople(all, { query: 'osaka' })).toEqual([])
  })
})
