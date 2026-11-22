/**
 * Hive in the group chat.
 *
 * After a member posts in a trip's group chat, the client pings
 * POST /api/trips/:tripId/hive-chat. Hive reads the recent conversation and
 * either stays quiet (replies NOOP) or:
 *  - adds stops the group clearly agreed on, directly (source 'ai', logged
 *    in the activity feed so everyone sees what changed), and/or
 *  - posts a place card for a place that came up: rating, must-try dishes,
 *    nearby food and things to do, cost, TripHive Featured perk and what
 *    other TripHivers said.
 *
 * Membership is checked before any model call, and every run reserves one
 * turn from the caller's owner-billed daily Hive budget (ai_usage).
 */
import type { Context, Hono } from 'hono'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod/v4'
import { streamDeepSpaceAgent, deepSpaceAgentErrorSummary, loggableError, type ActionTools } from 'deepspace/worker'
import { createActionTools } from '../server/action-routes.js'
import { TripError, cleanStop, findPlaces, getTrip, googleGate, logActivity, requireMember, userNames, type StopData } from '../server/trips.js'
import { featuredNear } from '../data/featured.js'
import { placeKey, summarizeReviews, type PlaceReviewData } from '../lib/reviews.js'
import { buildTripTools } from './trip-tools.js'
import type { AppContext } from '../../worker.js'

/** Owner-billed AI: per-user daily Hive turns, shared by the Hive panel and group chat. */
export const HIVE_DAILY_TURNS = 40
const GROUP_MODEL = 'claude-haiku-5-5'
const HISTORY = 20
const MAX_ADDS_PER_RUN = 3
const MAX_CARDS_PER_RUN = 2
const MIN_TEXT_LENGTH = 4
const TRIP_ID = /^[\w-]{1,80}$/
export const HIVE_SENDER = 'hive'

type RequireAccess = (c: Context<AppContext>) => Promise<{ auth: { userId: string } } | Response>
type Reserve = { ok: true } | { ok: false; status: 429 | 503; error: string }

/**
 * Reserve one Hive turn for the user today. Fails closed. Two simultaneous
 * requests can both pass the read: bounded overshoot of 1–2 turns, accepted.
 */
export async function reserveHiveTurn(tools: ActionTools, userId: string): Promise<Reserve> {
  const day = new Date().toISOString().slice(0, 10)
  const usage = await tools.query<{ count: number }>('ai_usage', { where: { userId, day }, limit: 1 })
  if (!usage.success) return { ok: false, status: 503, error: 'Usage check failed, try again' }
  const row = usage.data.records[0]
  const used = Number(row?.data.count ?? 0)
  if (used >= HIVE_DAILY_TURNS) {
    return { ok: false, status: 429, error: `Hive's daily limit (${HIVE_DAILY_TURNS} messages) is reached — try again tomorrow.` }
  }
  const reserved = row
    ? await tools.update('ai_usage', row.recordId, { count: used + 1 })
    : await tools.create('ai_usage', { userId, day, count: 1 })
  return reserved.success ? { ok: true } : { ok: false, status: 503, error: 'Usage check failed, try again' }
}

type ChatRow = { senderId: string; text: string }

export interface PlaceCard {
  name: string
  why: string
  category: StopData['category']
  date?: string
  lat?: number
  lng?: number
  address?: string
  rating?: number
  ratingCount?: number
  mapsUrl?: string
  mustTry: string[]
  nearbyFood: string[]
  thingsToDo: string[]
  tips: string[]
  costPerPersonUsd?: number
  featuredPerk?: string
  community: ReturnType<typeof summarizeReviews> & { quotes: string[] }
  added?: boolean
}

const HHMM = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const CATEGORY = z.enum(['food', 'sight', 'activity', 'stay', 'transport', 'other'])
const shortList = z.array(z.string().min(1).max(80)).max(5)

async function communityFor(tools: ActionTools, name: string, destination: string) {
  const res = await tools.query<PlaceReviewData & Record<string, unknown>>('place_reviews', {
    where: { placeKey: placeKey(name, destination) },
    limit: 50,
  })
  const rows = res.success ? res.data.records.map((r) => r.data) : []
  return { ...summarizeReviews(rows), quotes: rows.map((r) => r.text).filter((t): t is string => !!t).slice(0, 3) }
}

function groupTools(tools: ActionTools, tripId: string, userId: string, googleKey: string | undefined, out: { cards: PlaceCard[]; added: string[] }): ToolSet {
  const base = buildTripTools(tools, tripId, userId, googleKey)
  const google = googleGate(tools, userId, googleKey)
  return {
    get_trip_overview: base.get_trip_overview,
    search_places: base.search_places,
    get_featured_places: base.get_featured_places,
    find_coordinates: base.find_coordinates,

    add_stop_now: tool({
      description:
        'Add a stop to the shared itinerary right away. ONLY when the chat shows the group agreed ("let\'s do X Saturday", "book it", "add X"). Use find_coordinates first for lat/lng. Pick a free time slot on that day.',
      inputSchema: z.object({
        date: YMD,
        title: z.string().min(1).max(120),
        start: HHMM.optional(),
        end: HHMM.optional(),
        category: CATEGORY.optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        address: z.string().max(300).optional(),
        costPerPerson: z.number().min(0).optional().describe('USD'),
        outdoor: z.boolean().optional(),
        notes: z.string().max(500).optional(),
        because: z.string().max(160).describe('Quote or paraphrase of the chat that agreed on it'),
      }),
      execute: async ({ because, ...stop }) => {
        if (out.added.length >= MAX_ADDS_PER_RUN) return { error: `At most ${MAX_ADDS_PER_RUN} adds per message.` }
        try {
          const clean = cleanStop(stop as Partial<StopData>, false)
          const r = await tools.create('stops', { ...clean, tripId, source: 'ai' })
          if (!r.success) return { error: r.error }
          await logActivity(tools, tripId, HIVE_SENDER, `added ${clean.title} on ${clean.date} from group chat — ${because}`)
          out.added.push(`${clean.title} (${clean.date}${clean.start ? ` ${clean.start}` : ''})`)
          return { added: true, stopId: r.data.recordId }
        } catch (err) {
          if (err instanceof TripError) return { error: err.message }
          throw err
        }
      },
    }),

    share_place_card: tool({
      description:
        'Post a rich card about ONE specific place someone mentioned or asked about. Fill mustTry (dishes/drinks or highlights), nearbyFood, thingsToDo nearby, practical tips and a USD cost per person from your knowledge or search_places. The card is enriched with coordinates, rating, TripHive Featured perk and TripHiver reviews automatically.',
      inputSchema: z.object({
        name: z.string().min(2).max(120),
        why: z.string().max(200),
        category: CATEGORY,
        date: YMD.optional().describe('Suggested trip day'),
        mustTry: shortList,
        nearbyFood: shortList,
        thingsToDo: shortList,
        tips: shortList,
        costPerPersonUsd: z.number().min(0).optional(),
      }),
      execute: async (p) => {
        if (out.cards.length >= MAX_CARDS_PER_RUN) return { error: `At most ${MAX_CARDS_PER_RUN} cards per message.` }
        const trip = await getTrip(tools, tripId)
        if (!trip) return { error: 'Trip not found' }
        const hit = (await findPlaces(await google(), p.name, trip.data, 1).catch(() => []))[0]
        const featured = featuredNear(trip.data).find((f) => placeKey(f.name, '') === placeKey(p.name, ''))
        const card: PlaceCard = {
          ...p,
          lat: hit?.lat,
          lng: hit?.lng,
          address: hit?.address,
          rating: hit?.rating,
          ratingCount: hit?.ratingCount,
          mapsUrl: hit?.mapsUrl,
          featuredPerk: featured?.perk,
          community: await communityFor(tools, p.name, trip.data.destination),
        }
        out.cards.push(card)
        return { posted: true, community: card.community, featuredPerk: card.featuredPerk ?? null }
      },
    }),
  }
}

function groupPrompt(today: string): string {
  return [
    'You are Hive, the trip assistant sitting in a group chat of friends planning a trip together in TripHive.',
    `Today is ${today}. You see the latest messages; the LAST one just arrived.`,
    '',
    'Decide if the last message needs you. Reply with exactly NOOP (nothing else) when it is small talk, logistics between people, or already handled.',
    'Act when:',
    '- The group AGREED on a place/time ("let\'s do X Saturday", "add X", "book it") → get_trip_overview for free slots, find_coordinates, then add_stop_now. Never add something only one person floated; suggest it instead.',
    '- A specific place came up or someone asks about one → share_place_card with real dishes, nearby food, things to do, tips and cost. Call get_featured_places first and prefer TripHive Featured places.',
    '- Someone asks for ideas → up to 2 share_place_card calls for the best fits (search_places first).',
    'After tools, write ONE short chat reply (max 2 sentences, friendly, no markdown headings). Say what you added. Mention other TripHivers\' rating when the card has reviews.',
    'Costs are USD; say "≈$". Respect the slowest pace and tightest budget among members.',
  ].join('\n')
}

async function runHive(c: Context<AppContext>, tools: ActionTools, tripId: string, userId: string, rows: ChatRow[]): Promise<void> {
  const names = await userNames(tools, [...new Set(rows.map((r) => r.senderId).filter((s) => s !== HIVE_SENDER))])
  const transcript = rows.map((r) => `${r.senderId === HIVE_SENDER ? 'Hive' : (names[r.senderId]?.name ?? 'Traveler')}: ${r.text}`).join('\n')
  const out = { cards: [] as PlaceCard[], added: [] as string[] }
  const { result } = streamDeepSpaceAgent(c.env, {
    profile: 'application',
    modelId: GROUP_MODEL,
    effort: 'low',
    maxToolCalls: 8,
    instructions: groupPrompt(new Date().toISOString().slice(0, 10)),
    messages: [{ role: 'user', content: `Group chat so far:\n${transcript}` }],
    tools: groupTools(tools, tripId, userId, c.env.GOOGLE_MAPS_API_KEY, out),
    onError: ({ error }) => console.error(`[hive-group] stream error: ${deepSpaceAgentErrorSummary(error, { profile: 'application', modelId: GROUP_MODEL })}`),
  })
  const text = (await result.text).trim()
  const isQuiet = (!text || /^NOOP\.?$/i.test(text)) && out.cards.length === 0 && out.added.length === 0
  if (isQuiet) return
  const reply = text && !/^NOOP\.?$/i.test(text) ? text.slice(0, 1000) : out.added.length ? `Added ${out.added.join(', ')} to the plan.` : 'Here you go 👇'
  const r = await tools.create('trip_messages', { tripId, senderId: HIVE_SENDER, text: reply, ...(out.cards.length ? { cards: out.cards } : {}) })
  if (!r.success) console.error(`[hive-group] reply write failed: ${r.error}`)
}

export function registerHiveGroupRoute(app: Hono<AppContext>, requireAccess: RequireAccess): void {
  app.post('/api/trips/:tripId/hive-chat', async (c) => {
    const access = await requireAccess(c)
    if (access instanceof Response) return access
    const { userId } = access.auth
    const authHeader = c.req.header('Authorization') ?? ''
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!jwt) return c.json({ error: 'Unauthorized' }, 401)
    const tripId = c.req.param('tripId')
    if (!TRIP_ID.test(tripId)) return c.json({ error: 'Bad trip id' }, 400)

    const tools = createActionTools(c.env, userId, jwt)
    try {
      await requireMember(tools, tripId, userId)
    } catch (err) {
      if (err instanceof TripError) return c.json({ error: err.message }, 403)
      throw err
    }

    const res = await tools.query<ChatRow>('trip_messages', { where: { tripId }, orderBy: 'createdAt', orderDir: 'desc', limit: HISTORY })
    if (!res.success) return c.json({ error: 'Could not read chat' }, 503)
    const rows = res.data.records.map((r) => r.data).reverse()
    const last = rows.at(-1)
    // Only the author of the newest message triggers Hive, so one message = at
    // most one run, and Hive never answers itself.
    if (!last || last.senderId !== userId || last.text.trim().length < MIN_TEXT_LENGTH) return c.json({ skipped: true })

    const reserve = await reserveHiveTurn(tools, userId)
    if (!reserve.ok) return c.json({ error: reserve.error }, reserve.status)

    // Finish even if the tab closes: the reply lands in the shared chat.
    c.executionCtx.waitUntil(runHive(c, tools, tripId, userId, rows).catch((err) => console.error(`[hive-group] failed: ${loggableError(err)}`)))
    return c.json({ accepted: true }, 202)
  })
}
