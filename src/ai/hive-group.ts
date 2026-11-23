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
 * Membership is checked before any model call, and every run reserves a
 * turn from the trip's daily group budget, the caller's daily Hive budget and
 * the caller's burst slot (src/server/limits.ts). Runs on Groq (src/ai/llm.ts).
 */
import type { Context, Hono } from 'hono'
import { generateText, isStepCount, tool, type ToolSet } from 'ai'
import { z } from 'zod/v4'
import { loggableError, type ActionTools } from 'deepspace/worker'
import { HIVE_CONTEXT_CONFIG, HIVE_MAX_OUTPUT_TOKENS, HIVE_MAX_STEPS, capTools, resolveHiveModels, groqModel, hasGroq, rateLimitRetryAfter } from './llm.js'
import { LIMITS, reserveAll } from '../server/limits.js'
import { createActionTools } from '../server/action-routes.js'
import { TripError, addStopOnce, cleanStop, findPlaces, getTrip, googleGate, logActivity, requireMember, userNames, type StopData } from '../server/trips.js'
import { featuredNear } from '../data/featured.js'
import { placeKey, summarizeReviews, type PlaceReviewData } from '../lib/reviews.js'
import { buildTripTools } from './trip-tools.js'
import type { AppContext } from '../../worker.js'

const HISTORY = 20
const MAX_ADDS_PER_RUN = 3
const MAX_CARDS_PER_RUN = 2
const MIN_TEXT_LENGTH = 4
const TRIP_ID = /^[\w-]{1,80}$/
export const HIVE_SENDER = 'hive'
/** Cloudflare cancels waitUntil work ~30s after the response; finish well before. */
const RUN_DEADLINE_MS = 25_000
const BUSY_REPLY = "I'm a little swamped right now. Ask me again in a minute and I'll jump in."
const isTimeout = (err: unknown) => err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')

type RequireAccess = (c: Context<AppContext>) => Promise<{ auth: { userId: string } } | Response>

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
          const { stopId, isDuplicate } = await addStopOnce(tools, tripId, clean, 'ai')
          if (isDuplicate) return { added: false, stopId, note: `${clean.title} is already on ${clean.date}; not added again.` }
          await logActivity(tools, tripId, HIVE_SENDER, `added ${clean.title} on ${clean.date} from group chat — ${because}`)
          out.added.push(`${clean.title} (${clean.date}${clean.start ? ` ${clean.start}` : ''})`)
          return { added: true, stopId }
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
  const full = rows.map((r) => `${r.senderId === HIVE_SENDER ? 'Hive' : (names[r.senderId]?.name ?? 'Traveler')}: ${r.text}`).join('\n')
  // Newest messages matter most; keep the tail within Hive's Groq budget.
  const transcript = full.length > HIVE_CONTEXT_CONFIG.contextBudget ? full.slice(-HIVE_CONTEXT_CONFIG.contextBudget) : full
  const out = { cards: [] as PlaceCard[], added: [] as string[] }
  const abortSignal = AbortSignal.timeout(RUN_DEADLINE_MS)
  // No SDK retry on the main model: a 429 there switches straight to the fast
  // model, which has its own Groq token budget.
  const call = (modelId: string, maxRetries: number) =>
    generateText({
      abortSignal,
      maxRetries,
      model: groqModel(c.env, modelId),
      instructions: groupPrompt(new Date().toISOString().slice(0, 10)),
      messages: [{ role: 'user', content: `Group chat so far:\n${transcript}` }],
      tools: capTools(groupTools(tools, tripId, userId, c.env.GOOGLE_MAPS_API_KEY, out)),
      stopWhen: isStepCount(HIVE_MAX_STEPS),
      maxOutputTokens: HIVE_MAX_OUTPUT_TOKENS,
    })
  const models = await resolveHiveModels(c.env)
  let result: Awaited<ReturnType<typeof call>>
  try {
    result = await call(models.main, 0)
  } catch (err) {
    // Main model rate-limited before doing anything: retry once on the fast one.
    if (rateLimitRetryAfter(err) == null || out.cards.length || out.added.length) throw err
    result = await call(models.fast, 1)
  }
  const text = result.text.trim()
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

    if (!hasGroq(c.env)) return c.json({ skipped: true, reason: 'Hive is offline: GROQ_API_KEY is not set' })
    const reservation = await reserveAll(tools, [
      [`trip:${tripId}`, LIMITS.hiveGroup],
      [userId, LIMITS.hiveChat],
      [userId, LIMITS.burst],
    ])
    if (!reservation.ok) return c.json({ error: reservation.error }, reservation.status)

    // Finish even if the tab closes: the reply lands in the shared chat.
    const run = runHive(c, tools, tripId, userId, rows).catch(async (err) => {
      console.error(`[hive-group] failed: ${loggableError(err)}`)
      if (rateLimitRetryAfter(err) == null && !isTimeout(err)) return
      await reservation.refund()
      // Say so in the chat instead of leaving "Hive is reading the chat…" hanging.
      const r = await tools.create('trip_messages', { tripId, senderId: HIVE_SENDER, text: BUSY_REPLY })
      if (!r.success) console.error(`[hive-group] busy reply write failed: ${r.error}`)
    })
    c.executionCtx.waitUntil(run)
    return c.json({ accepted: true }, 202)
  })
}
