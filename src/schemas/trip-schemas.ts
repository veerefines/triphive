/**
 * TripHive collections.
 *
 * Access model: every trip is a DeepSpace "team". A `team_members` row
 * (teamId = trip recordId) grants a user the `'team'` permission level on
 * every collection whose `teamField` points at that trip. Membership rows are
 * written ONLY by server actions (createTrip / joinTrip), so a client can never
 * add itself to someone else's trip.
 *
 * DeepSpace RBAC `create` is a boolean, not row-scoped: `create: true` would
 * let any signed-in user insert rows into a trip they are not on. So every
 * collection here is `create: false`; rows are created by server actions that
 * call `requireMember` first (addStop, savePrefs, …). Updates/deletes ARE
 * row-scoped (`'team'` / `'own'`), so edits stay direct, realtime writes.
 */
import type { CollectionSchema } from 'deepspace/schema'

const SERVER_ONLY = { create: false, update: false, delete: false } as const
const ADMIN = { read: true, create: true, update: true, delete: true } as const

export const tripsSchema: CollectionSchema = {
  name: 'trips',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'destination', storage: 'text', interpretation: 'plain', required: true },
    { name: 'startDate', storage: 'text', interpretation: { kind: 'date' }, required: true },
    { name: 'endDate', storage: 'text', interpretation: { kind: 'date' }, required: true },
    // Equals the trip's own recordId; lets `'team'` resolve on the trip row itself.
    { name: 'teamId', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'inviteCode', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'lat', storage: 'number', interpretation: 'plain' },
    { name: 'lng', storage: 'number', interpretation: 'plain' },
    // { [YYYY-MM-DD]: { min, max, desc, rain } } — written by refreshWeather.
    { name: 'forecast', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'forecastAt', storage: 'text', interpretation: 'plain' },
    { name: 'coverUrl', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['inviteCode'],
  teamField: 'teamId',
  permissions: {
    member: {
      read: 'team',
      create: false,
      update: 'team',
      delete: 'own',
      writableFields: ['title', 'destination', 'startDate', 'endDate'],
    },
    admin: ADMIN,
  },
}

export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['active', 'left'] } },
    { name: 'role', storage: 'text', interpretation: { kind: 'select', options: ['owner', 'member'] } },
  ],
  uniqueOn: ['teamId', 'userId'],
  teamField: 'teamId',
  permissions: {
    member: { read: 'team', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const STOP_CATEGORIES = ['food', 'sight', 'activity', 'stay', 'transport', 'other'] as const

export const stopsSchema: CollectionSchema = {
  name: 'stops',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'date', storage: 'text', interpretation: { kind: 'date' }, required: true },
    { name: 'start', storage: 'text', interpretation: 'plain' }, // HH:MM
    { name: 'end', storage: 'text', interpretation: 'plain' }, // HH:MM
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'notes', storage: 'text', interpretation: 'plain' },
    { name: 'address', storage: 'text', interpretation: 'plain' },
    { name: 'url', storage: 'text', interpretation: { kind: 'url' } },
    { name: 'category', storage: 'text', interpretation: { kind: 'select', options: [...STOP_CATEGORIES] } },
    { name: 'lat', storage: 'number', interpretation: 'plain' },
    { name: 'lng', storage: 'number', interpretation: 'plain' },
    { name: 'costPerPerson', storage: 'number', interpretation: { kind: 'currency', symbol: '$', decimals: 0 } },
    { name: 'outdoor', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'fixedTime', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'source', storage: 'text', interpretation: { kind: 'select', options: ['human', 'ai'] } },
  ],
  teamField: 'tripId',
  permissions: {
    member: { read: 'team', create: false, update: 'team', delete: 'team', writableFields: [
      'date', 'start', 'end', 'title', 'notes', 'address', 'url', 'category',
      'lat', 'lng', 'costPerPerson', 'outdoor', 'fixedTime',
    ] },
    admin: ADMIN,
  },
}

export const PACES = ['chill', 'balanced', 'packed'] as const

export const prefsSchema: CollectionSchema = {
  name: 'prefs',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'dailyBudget', storage: 'number', interpretation: { kind: 'currency', symbol: '$', decimals: 0 } },
    { name: 'pace', storage: 'text', interpretation: { kind: 'select', options: [...PACES] } },
    { name: 'interests', storage: 'text', interpretation: 'plain' },
    { name: 'dietary', storage: 'text', interpretation: 'plain' },
    { name: 'wakeTime', storage: 'text', interpretation: 'plain' }, // HH:MM
  ],
  uniqueOn: ['tripId', 'userId'],
  ownerField: 'userId',
  teamField: 'tripId',
  permissions: {
    member: { read: 'team', create: false, update: 'own', delete: 'own', writableFields: [
      'dailyBudget', 'pace', 'interests', 'dietary', 'wakeTime',
    ] },
    admin: ADMIN,
  },
}

export const ISSUE_TYPES = [
  'overlap',
  'travel',
  'outside-dates',
  'overloaded',
  'meal-gap',
  'rain',
  'budget',
  'duplicate',
  'early-start',
] as const

export const issuesSchema: CollectionSchema = {
  name: 'issues',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'date', storage: 'text', interpretation: 'plain' },
    { name: 'type', storage: 'text', interpretation: { kind: 'select', options: [...ISSUE_TYPES] } },
    { name: 'severity', storage: 'text', interpretation: { kind: 'select', options: ['warn', 'error'] } },
    { name: 'message', storage: 'text', interpretation: 'plain' },
    { name: 'stopIds', storage: 'text', interpretation: { kind: 'json' } },
  ],
  teamField: 'tripId',
  permissions: {
    member: { read: 'team', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const proposalsSchema: CollectionSchema = {
  name: 'proposals',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'kind', storage: 'text', interpretation: { kind: 'select', options: ['add', 'update', 'remove'] } },
    // add: { stop }, update: { stopId, patch }, remove: { stopId }
    { name: 'payload', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'summary', storage: 'text', interpretation: 'plain' },
    { name: 'reason', storage: 'text', interpretation: 'plain' },
    { name: 'sources', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['pending', 'accepted', 'rejected', 'stale'] } },
    { name: 'votes', storage: 'text', interpretation: { kind: 'json' } }, // { userId: 1 | -1 }
    { name: 'proposedFor', storage: 'text', interpretation: 'plain' }, // userId who asked Hive
  ],
  teamField: 'tripId',
  permissions: {
    member: { read: 'team', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const activitySchema: CollectionSchema = {
  name: 'activity',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'actorId', storage: 'text', interpretation: 'plain' }, // userId or 'hive'
    { name: 'text', storage: 'text', interpretation: 'plain' },
  ],
  teamField: 'tripId',
  permissions: {
    member: { read: 'team', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const tripSchemas: CollectionSchema[] = [
  tripsSchema,
  teamMembersSchema,
  stopsSchema,
  prefsSchema,
  issuesSchema,
  proposalsSchema,
  activitySchema,
]
