/**
 * Pure planner for the demo world: turns src/data/demo.ts into the exact rows
 * to write. No I/O, so the shape is unit-tested; src/server/demo.ts executes it.
 */
import type { PlaceCard } from '../ai/hive-group'
import { DEMO_PROFILES, DEMO_REVIEWS, DEMO_TRIPS, ME, type DemoTrip, type DemoUser } from '../data/demo'
import { cityOf, placeKey, summarizeReviews } from './reviews'

const MAX_QUOTES = 2
const MAX_HIGHLIGHT_DAYS = 7
const MAX_HIGHLIGHT_TITLES = 4
const DAY_MS = 86_400_000

export type Row = Record<string, unknown>
/** A row that must be written as a specific user (userBound columns). */
export type OwnedRow = { as: string; data: Row }
export type IdRow = { id: string; data: Row }

export type SeedPlan = {
  profiles: OwnedRow[]
  trips: IdRow[]
  members: Row[]
  stops: Row[]
  prefs: OwnedRow[]
  /** In display order: humans first, then the Hive reply. */
  messages: Row[]
  activity: Row[]
  listings: Row[]
  requests: IdRow[]
  dms: Row[]
  reviews: Row[]
}

export type PlanInput = {
  ownerId: string
  ownerName: string
  /** YYYY-MM-DD the seed runs on. */
  today: string
  hiveSender: string
  newId: (prefix: string) => string
  inviteCode: () => string
  nowIso: string
}

export function addDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS
  return new Date(t).toISOString().slice(0, 10)
}

function community(name: string, destination: string): PlaceCard['community'] {
  const key = placeKey(name, destination)
  const rows = DEMO_REVIEWS.filter((r) => placeKey(r.place, r.destination) === key)
  return { ...summarizeReviews(rows), quotes: rows.map((r) => r.text).slice(0, MAX_QUOTES) }
}

function hiveCard(trip: DemoTrip, start: string): PlaceCard {
  const { day, ...card } = trip.hive.card
  return { ...card, date: addDays(start, day), community: community(card.name, trip.destination) }
}

function highlights(trip: DemoTrip, start: string): { date: string; titles: string[] }[] {
  const days = [...new Set(trip.stops.map((s) => s.day))].sort((a, b) => a - b).slice(0, MAX_HIGHLIGHT_DAYS)
  return days.map((d) => ({
    date: addDays(start, d),
    titles: trip.stops.filter((s) => s.day === d).map((s) => s.title).slice(0, MAX_HIGHLIGHT_TITLES),
  }))
}

type TripRows = Omit<SeedPlan, 'profiles' | 'reviews'>
type Resolve = (u: DemoUser) => string

function planRequests(trip: DemoTrip, tripId: string, start: string, end: string, input: PlanInput, resolve: Resolve) {
  const hostId = resolve(trip.host)
  const requests: IdRow[] = []
  const dms: Row[] = []
  for (const req of trip.requests) {
    const requestId = input.newId('req')
    const requesterId = resolve(req.requester)
    const participants = [requesterId, hostId]
    requests.push({
      id: requestId,
      data: {
        tripId, tripTitle: trip.title, destination: trip.destination, startDate: start, endDate: end,
        requesterId, ownerId: hostId, participants, pitch: req.pitch, status: req.status, lastMessageAt: input.nowIso,
      },
    })
    dms.push({ requestId, participants, senderId: requesterId, text: req.pitch })
    for (const reply of req.replies) {
      dms.push({ requestId, participants, senderId: reply.from === 'system' ? 'system' : resolve(reply.from), text: reply.text })
    }
  }
  return { requests, dms }
}

function planTrip(trip: DemoTrip, tripId: string, input: PlanInput, resolve: Resolve, nameOf: (u: DemoUser) => string): TripRows {
  const start = addDays(input.today, trip.startOffset)
  const end = addDays(start, trip.days - 1)
  const hostId = resolve(trip.host)
  const listing = trip.listing

  return {
    trips: [{
      id: tripId,
      data: {
        title: trip.title, destination: trip.destination, startDate: start, endDate: end,
        teamId: tripId, inviteCode: input.inviteCode(), lat: trip.lat, lng: trip.lng,
        visibility: listing ? 'public' : 'private',
      },
    }],
    members: trip.members.map((m) => ({ teamId: tripId, userId: resolve(m), status: 'active', role: m === trip.host ? 'owner' : 'member' })),
    stops: trip.stops.map((s) => ({
      tripId, date: addDays(start, s.day), start: s.start, end: s.end, title: s.title, category: s.category,
      lat: s.lat, lng: s.lng, costPerPerson: s.cost, outdoor: !!s.outdoor, fixedTime: !!s.fixedTime,
      ...(s.notes ? { notes: s.notes } : {}), source: 'demo',
    })),
    prefs: Object.entries(trip.prefs).map(([u, p]) => ({ as: resolve(u as DemoUser), data: { tripId, ...p } })),
    messages: [
      ...trip.chat.map((m) => ({ tripId, senderId: resolve(m.from), text: m.text })),
      { tripId, senderId: input.hiveSender, text: trip.hive.text, cards: [hiveCard(trip, start)] },
    ],
    activity: [
      { tripId, actorId: hostId, text: `created the trip to ${trip.destination}` },
      ...trip.members.filter((m) => m !== trip.host).map((m) => ({ tripId, actorId: resolve(m), text: 'joined the trip' })),
      { tripId, actorId: input.hiveSender, text: `suggested ${trip.hive.card.name}` },
    ],
    listings: listing
      ? [{
          tripId, ownerId: hostId, hostName: nameOf(trip.host), title: trip.title, destination: trip.destination,
          lat: trip.lat, lng: trip.lng, startDate: start, endDate: end, memberCount: trip.members.length,
          highlights: highlights(trip, start), ...listing,
        }]
      : [],
    ...planRequests(trip, tripId, start, end, input, resolve),
  }
}

export function planSeed(input: PlanInput): SeedPlan {
  const resolve: Resolve = (u) => (u === ME ? input.ownerId : u)
  const names = new Map<string, string>(DEMO_PROFILES.map((p) => [p.userId, p.displayName]))
  const nameOf = (u: DemoUser): string => (u === ME ? input.ownerName : names.get(u) ?? 'Traveler')

  const tripIds = new Map(DEMO_TRIPS.map((t) => [t.key, input.newId('trip')]))
  const perTrip = DEMO_TRIPS.map((t) => planTrip(t, tripIds.get(t.key)!, input, resolve, nameOf))
  const merge = <K extends keyof TripRows>(k: K): TripRows[K] => perTrip.flatMap((r) => r[k]) as TripRows[K]

  const tripByCity = new Map(DEMO_TRIPS.map((t) => [cityOf(t.destination), tripIds.get(t.key)!]))
  const reviews = DEMO_REVIEWS.map((r) => ({
    placeKey: placeKey(r.place, r.destination), name: r.place, city: cityOf(r.destination),
    userId: resolve(r.by), tripId: tripByCity.get(cityOf(r.destination)) ?? '', rating: r.rating, text: r.text,
    ...(r.spentUsd !== undefined ? { spentUsd: r.spentUsd } : {}),
  }))

  return {
    profiles: DEMO_PROFILES.map((p) => ({ as: resolve(p.userId), data: { ...p, userId: resolve(p.userId) } })),
    trips: merge('trips'),
    members: merge('members'),
    stops: merge('stops'),
    prefs: merge('prefs'),
    messages: merge('messages'),
    activity: merge('activity'),
    listings: merge('listings'),
    requests: merge('requests'),
    dms: merge('dms'),
    reviews,
  }
}
