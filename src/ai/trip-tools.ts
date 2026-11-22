/**
 * Hive — the trip agent's tools.
 *
 * The chat route binds these to ONE trip after verifying the caller is a
 * member, so the model can never name another trip. Hive can read anything
 * on the trip, search the web, geocode, check weather and run Plan Doctor —
 * but it cannot edit the itinerary. Its only write is a *proposal* that the
 * group votes on (see voteOnProposal in src/server/trips.ts).
 */
import { tool, type ToolSet } from 'ai'
import { z } from 'zod/v4'
import type { ActionTools } from 'deepspace/worker'
import { groupByDate, sortDay, toMinutes } from '../lib/planCheck'
import { nearestNeighbourOrder, routeLegs, totalKm } from '../lib/geo'
import {
  TripError,
  createProposal,
  geocodePlace,
  listMembers,
  loadPlan,
  logActivity,
  refreshWeather,
  runPlanCheck,
  searchPlaces,
  toStopLike,
  userNames,
} from '../server/trips'

const HHMM = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'HH:MM 24h')
const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

const stopFields = {
  date: YMD,
  start: HHMM.optional(),
  end: HHMM.optional(),
  title: z.string().min(1).max(120),
  notes: z.string().max(1000).optional(),
  address: z.string().max(300).optional(),
  url: z.string().url().optional(),
  category: z.enum(['food', 'sight', 'activity', 'stay', 'transport', 'other']).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  costPerPerson: z.number().min(0).optional(),
  outdoor: z.boolean().optional(),
  fixedTime: z.boolean().optional(),
}

const proposalMeta = {
  summary: z.string().max(200).describe('One line shown on the proposal card, e.g. "Move LX Factory to 15:00"'),
  reason: z.string().max(1000).describe('Why — name which member preference, issue or source drove it'),
  sources: z.array(z.string()).max(5).optional().describe('Source URLs from search_places'),
}

async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof TripError) return { error: err.message }
    throw err
  }
}

export function buildTripTools(tools: ActionTools, tripId: string, userId: string): ToolSet {
  return {
    get_trip_overview: tool({
      description:
        'Read the whole trip: dates, destination, forecast, members with their preferences, every stop grouped by day (with ids), open Plan Doctor issues and pending proposals. Call this first.',
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          const { trip, stops, prefs } = await loadPlan(tools, tripId)
          const members = await listMembers(tools, tripId)
          const names = await userNames(tools, members.map((m) => m.data.userId))
          const issues = await tools.query('issues', { where: { tripId }, limit: 100 })
          const proposals = await tools.query('proposals', { where: { tripId, status: 'pending' }, limit: 50 })
          const days = groupByDate(stops.map((s) => ({ ...toStopLike(s.recordId, s.data), fixedTime: !!s.data.fixedTime, notes: s.data.notes, source: s.data.source })))
          return {
            trip: {
              title: trip.data.title,
              destination: trip.data.destination,
              startDate: trip.data.startDate,
              endDate: trip.data.endDate,
              center: trip.data.lat != null ? { lat: trip.data.lat, lng: trip.data.lng } : null,
              forecast: trip.data.forecast ?? null,
            },
            members: members.map((m) => {
              const p = prefs.find((x) => x.userId === m.data.userId)
              return { userId: m.data.userId, name: names[m.data.userId]?.name, role: m.data.role, prefs: p ?? 'not set' }
            }),
            askingUser: names[userId]?.name ?? userId,
            days: Object.fromEntries([...days.entries()].sort(([a], [b]) => a.localeCompare(b))),
            issues: issues.success ? issues.data.records.map((r) => r.data) : [],
            pendingProposals: proposals.success ? proposals.data.records.map((r) => ({ id: r.recordId, ...r.data })) : [],
          }
        }),
    }),

    search_places: tool({
      description:
        'Web search (Exa) for real places at the destination — restaurants, sights, activities, neighbourhoods. Returns source pages with summaries naming specific places. Use the URLs as proposal sources.',
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe('e.g. "vegetarian lunch near Alfama", "rainy day museums"'),
        numResults: z.number().int().min(1).max(8).optional(),
      }),
      execute: ({ query, numResults }) =>
        guard(async () => {
          const { trip } = await loadPlan(tools, tripId)
          return { results: await searchPlaces(tools, query, trip.data.destination, numResults ?? 5) }
        }),
    }),

    find_coordinates: tool({
      description:
        'Geocode a specific named place (OpenStreetMap) near the trip destination. Always do this before proposing a new stop so routing and travel checks work.',
      inputSchema: z.object({ place: z.string().min(2).max(160) }),
      execute: ({ place }) =>
        guard(async () => {
          const { trip } = await loadPlan(tools, tripId)
          let hits = await geocodePlace(place, trip.data, 3)
          if (!hits.length) hits = await geocodePlace(`${place}, ${trip.data.destination}`, undefined, 3)
          return hits.length ? { candidates: hits } : { error: 'No match; try a more specific name or skip coordinates.' }
        }),
    }),

    get_weather: tool({
      description: 'Refresh and return the per-day forecast (next ~5 days only; later dates have no forecast).',
      inputSchema: z.object({}),
      execute: () => guard(async () => ({ forecast: await refreshWeather(tools, tripId) })),
    }),

    check_plan: tool({
      description:
        'Run Plan Doctor: deterministic checks for time overlaps, impossible travel gaps, stops outside the dates, overloaded days vs pace, missing meals, outdoor stops on rainy days, budget, duplicates, early starts. Also refreshes the issues everyone sees.',
      inputSchema: z.object({}),
      execute: () => guard(async () => ({ issues: await runPlanCheck(tools, tripId) })),
    }),

    estimate_route: tool({
      description: 'Approximate route for one day in the current visit order: per-leg km, mode (walk/transit) and minutes, plus total km.',
      inputSchema: z.object({ date: YMD }),
      execute: ({ date }) =>
        guard(async () => {
          const { stops } = await loadPlan(tools, tripId)
          const day = sortDay(stops.filter((s) => s.data.date === date).map((s) => toStopLike(s.recordId, s.data)))
          const legs = routeLegs(day).map((l) => ({ from: day[l.fromIndex].title, to: day[l.toIndex].title, km: l.km, mode: l.mode, minutes: l.minutes }))
          return { stops: day.map((s) => ({ id: s.id, title: s.title, start: s.start })), legs, totalKm: totalKm(day), note: 'Straight-line estimates ×1.3 detour; not live transit data.' }
        }),
    }),

    optimize_day: tool({
      description:
        'Suggest a shorter visiting order for a day (nearest-neighbour, fixed-time stops stay put). Returns the order and km saved. Does NOT change anything — follow up with propose_update_stop for new start times if worthwhile.',
      inputSchema: z.object({ date: YMD }),
      execute: ({ date }) =>
        guard(async () => {
          const { stops } = await loadPlan(tools, tripId)
          const day = sortDay(
            stops.filter((s) => s.data.date === date).map((s) => ({ ...toStopLike(s.recordId, s.data), fixed: !!s.data.fixedTime })),
          )
          const best = nearestNeighbourOrder(day)
          const before = totalKm(day)
          const after = totalKm(best)
          return {
            currentOrder: day.map((s) => `${s.start ?? '--:--'} ${s.title}`),
            suggestedOrder: best.map((s) => ({ id: s.id, title: s.title, currentStart: s.start, fixed: s.fixed })),
            kmBefore: before,
            kmAfter: after,
            worthIt: before - after >= 1,
          }
        }),
    }),

    propose_add_stop: tool({
      description:
        'Propose adding a stop. The group votes before it lands. Include lat/lng from find_coordinates, a time slot that does not overlap, category, cost estimate in USD and whether it is outdoors.',
      inputSchema: z.object({ stop: z.object(stopFields), ...proposalMeta }),
      execute: ({ stop, summary, reason, sources }) =>
        guard(async () => {
          const r = await createProposal(tools, tripId, userId, { kind: 'add', stop, summary, reason, sources })
          await logActivity(tools, tripId, 'hive', `proposed: ${summary}`)
          return { ...r, status: 'pending — the group will vote' }
        }),
    }),

    propose_update_stop: tool({
      description: 'Propose changing an existing stop (retime, move to another day, fix details). Only include changed fields.',
      inputSchema: z.object({
        stopId: z.string(),
        patch: z.object(stopFields).partial(),
        ...proposalMeta,
      }),
      execute: ({ stopId, patch, summary, reason, sources }) =>
        guard(async () => {
          const r = await createProposal(tools, tripId, userId, { kind: 'update', stopId, patch, summary, reason, sources })
          await logActivity(tools, tripId, 'hive', `proposed: ${summary}`)
          return { ...r, status: 'pending — the group will vote' }
        }),
    }),

    propose_remove_stop: tool({
      description: 'Propose removing a stop (e.g. duplicate, infeasible). Explain why.',
      inputSchema: z.object({ stopId: z.string(), ...proposalMeta }),
      execute: ({ stopId, summary, reason, sources }) =>
        guard(async () => {
          const r = await createProposal(tools, tripId, userId, { kind: 'remove', stopId, summary, reason, sources })
          await logActivity(tools, tripId, 'hive', `proposed: ${summary}`)
          return { ...r, status: 'pending — the group will vote' }
        }),
    }),
  }
}

export function tripSystemPrompt(today: string): string {
  return [
    'You are Hive, the planning assistant inside TripHive — a shared itinerary that a group of friends edits together in real time.',
    `Today is ${today}.`,
    '',
    'How you work:',
    '1. Start every task with get_trip_overview. Use the real stop ids, member preferences, issues and forecast it returns. Never invent ids.',
    '2. You cannot edit the itinerary directly. Every change is a proposal (propose_add_stop / propose_update_stop / propose_remove_stop) that the group votes on. Say so briefly when you make them.',
    '3. Before proposing a new place: search_places to find real, specific, currently-operating places, then find_coordinates for lat/lng. Cite source URLs in `sources`.',
    '4. Respect everyone: the slowest pace, the tightest budget, dietary needs, the latest wake time. In `reason`, name whose preference drove the choice ("Ana is vegetarian", "Sam\'s $80/day budget").',
    '5. Avoid overlaps and leave realistic travel time (use estimate_route). Prefer clustering stops by neighbourhood; use optimize_day when a day zig-zags.',
    '6. After proposing changes, run check_plan mentally against them; if the user asks to "fix" things, read issues first and propose the smallest set of changes that resolves them.',
    '7. Outdoor stops on rainy forecast days should get an indoor alternative or a swap with a dry day.',
    '8. costPerPerson and budgets are in USD — convert local prices to approximate USD and say "≈$".',
    '9. Be concise. Summarise what you proposed as a short bullet list. Use 24h HH:MM times and YYYY-MM-DD dates.',
    'Do not make more than 6 proposals per turn unless asked.',
  ].join('\n')
}
