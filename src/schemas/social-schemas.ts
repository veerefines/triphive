/**
 * TripHive social layer: traveler profiles, public trip listings, join
 * requests with a private request thread, and per-trip group chat.
 *
 * Access model:
 * - `trips`/`stops` stay `'team'`. A public trip is advertised through a
 *   separate `public_trips` *listing snapshot* written only by the server, so
 *   strangers never see the invite code, stops, prefs or member ids.
 * - `join_requests` and `dm_messages` carry `participants` = [requester, owner]
 *   as a `collaboratorsField`, so only those two users can read the thread.
 * - Every collection is `create: false` for members; rows are created by
 *   server actions that check who the caller is (src/actions/social.ts).
 */
import type { CollectionSchema } from 'deepspace/schema'

const SERVER_ONLY = { create: false, update: false, delete: false } as const
const ADMIN = { read: true, create: true, update: true, delete: true } as const

export const profilesSchema: CollectionSchema = {
  name: 'profiles',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain' },
    { name: 'avatarEmoji', storage: 'text', interpretation: 'plain' },
    { name: 'homeCity', storage: 'text', interpretation: 'plain' },
    { name: 'bio', storage: 'text', interpretation: 'plain' },
    { name: 'travelStyle', storage: 'text', interpretation: 'plain' },
    { name: 'interests', storage: 'text', interpretation: { kind: 'json' } }, // string[]
    { name: 'languages', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['userId'],
  ownerField: 'userId',
  permissions: {
    member: { read: true, ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const publicTripsSchema: CollectionSchema = {
  name: 'public_trips',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hostName', storage: 'text', interpretation: 'plain' },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'destination', storage: 'text', interpretation: 'plain', required: true },
    { name: 'lat', storage: 'number', interpretation: 'plain' },
    { name: 'lng', storage: 'number', interpretation: 'plain' },
    { name: 'startDate', storage: 'text', interpretation: { kind: 'date' }, required: true },
    { name: 'endDate', storage: 'text', interpretation: { kind: 'date' }, required: true },
    { name: 'description', storage: 'text', interpretation: 'plain' },
    { name: 'vibes', storage: 'text', interpretation: { kind: 'json' } }, // string[]
    { name: 'openSpots', storage: 'number', interpretation: 'plain' },
    { name: 'memberCount', storage: 'number', interpretation: 'plain' },
    { name: 'highlights', storage: 'text', interpretation: { kind: 'json' } }, // { date, titles[] }[]
  ],
  uniqueOn: ['tripId'],
  permissions: {
    member: { read: true, ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const joinRequestsSchema: CollectionSchema = {
  name: 'join_requests',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'tripTitle', storage: 'text', interpretation: 'plain' },
    { name: 'destination', storage: 'text', interpretation: 'plain' },
    { name: 'startDate', storage: 'text', interpretation: 'plain' },
    { name: 'endDate', storage: 'text', interpretation: 'plain' },
    { name: 'requesterId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'participants', storage: 'text', interpretation: { kind: 'json' } }, // [requesterId, ownerId]
    { name: 'pitch', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['pending', 'accepted', 'declined'] } },
    { name: 'lastMessageAt', storage: 'text', interpretation: 'plain' },
  ],
  collaboratorsField: 'participants',
  permissions: {
    member: { read: 'collaborator', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const dmMessagesSchema: CollectionSchema = {
  name: 'dm_messages',
  columns: [
    { name: 'requestId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'participants', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'senderId', storage: 'text', interpretation: 'plain', required: true }, // userId or 'system'
    { name: 'text', storage: 'text', interpretation: 'plain', required: true },
  ],
  collaboratorsField: 'participants',
  permissions: {
    member: { read: 'collaborator', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const tripMessagesSchema: CollectionSchema = {
  name: 'trip_messages',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'senderId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'text', storage: 'text', interpretation: 'plain', required: true },
    // Hive place cards attached to a Hive message (senderId 'hive').
    { name: 'cards', storage: 'text', interpretation: { kind: 'json' } },
  ],
  teamField: 'tripId',
  permissions: {
    member: { read: 'team', ...SERVER_ONLY },
    admin: ADMIN,
  },
}

/** TripHiver reviews of places, shared across trips (keyed by src/lib/reviews placeKey). */
export const placeReviewsSchema: CollectionSchema = {
  name: 'place_reviews',
  columns: [
    { name: 'placeKey', storage: 'text', interpretation: 'plain', required: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'city', storage: 'text', interpretation: 'plain' },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'tripId', storage: 'text', interpretation: 'plain' },
    { name: 'rating', storage: 'number', interpretation: 'plain', required: true },
    { name: 'text', storage: 'text', interpretation: 'plain' },
    { name: 'spentUsd', storage: 'number', interpretation: 'plain' },
  ],
  permissions: {
    member: { read: true, ...SERVER_ONLY },
    admin: ADMIN,
  },
}

export const socialSchemas: CollectionSchema[] = [
  placeReviewsSchema,
  profilesSchema,
  publicTripsSchema,
  joinRequestsSchema,
  dmMessagesSchema,
  tripMessagesSchema,
]
