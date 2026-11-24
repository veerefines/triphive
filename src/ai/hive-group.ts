/**
 * Hive in the group chat, summoned with `@Hive`.
 *
 * When a member's message mentions @Hive, the client pings
 * POST /api/trips/:tripId/hive-chat. Hive answers only that message (plus a
 * three-line tail of context and a one-line-per-day plan summary, never the
 * whole chat) and replies with up to two researched place cards: rating,
 * must-try dishes, nearby food and things to do, cost, TripHive Featured perk
 * and what other TripHivers said. Hive never edits the plan itself: members
 * add a card to the plan or put it to a group vote from the card.
 *
 * Membership is checked before any model call, and every run reserves a
 * turn from the trip's daily group budget, the caller's daily Hive budget and
 * the caller's burst slot (src/server/limits.ts). Runs on Groq (src/ai/llm.ts).
 */
import type { Context, Hono } from 'hono'
import { generateText, isStepCount, tool, type ToolSet } from 'ai'
import { z } from 'zod/v4'
import { loggableError, type ActionTools } from 'deepspace/worker'
import { HIVE_CONTEXT_CONFIG, HIVE_MAX_OUTPUT_TOKENS, HIVE_MAX_STEPS, capTools, resolveHiveModels, groqModel, hasGroq, hiveCooldown, rateLimitRetryAfter } from './llm.js'
import { LIMITS, reserveAll } from '../server/limits.js'
import { createActionTools } from '../server/action-routes.js'
import { TripError, findPlaces, getTrip, googleGate, requireMember, userNames, type StopData } from '../server/trips.js'
import { featuredNear } from '../data/featured.js'
import { placeKey, summarizeReviews, type PlaceReviewData } from '../lib/reviews.js'
import { buildTripTools } from './trip-tools.js'
import { buildHiveAsk, summarizePlan, CONTEXT_LINES, type ChatLine, type HiveAsk } from './hive-ask.js'
import { tripDates } from '../lib/planCheck.js'
import type { AppContext } from '../../worker.js'

/** The mention plus a short context tail; Hive never reads further back. */
const HISTORY = CONTEXT_LINES + 3
const MAX_CARDS_PER_RUN = 2
const MAX_PLAN_STOPS = 120
const GROUP_MAX_STEPS = 5
const TRIP_ID = /^[\w-]{1,80}$/
export const HIVE_SENDER = 'hive'
/** Cloudflare cancels waitUntil work ~30s after the response; finish well before. */
const RUN_DEADLINE_MS = 25_000
const BUSY_REPLY = "I'm a little swamped right now. Ask me again in a minute and I'll jump in."
const isTimeout = (err: unknown) => err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')

type RequireAccess = (c: Context<AppContext>) => Promise<{ auth: { userId: string } } | Response>

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

function groupTools(tools: ActionTools, tripId: string, userId: string, googleKey: string | undefined, out: { cards: PlaceCard[] }): ToolSet {
  const base = buildTripTools(tools, tripId, userId, googleKey)
  const google = googleGate(tools, userId, googleKey)
  return {
    search_places: base.search_places,
    get_featured_places: base.get_featured_places,

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
    'You are Hive, the trip assistant in a TripHive group chat. A member just called you with @Hive.',
    `Today is ${today}. You get their request, a few lines of recent chat for context, and the current plan by day.`,
    '',
    'When the request is about places (food, things to do, "add something", "find X near Y", "surprise us"):',
    '- Research with search_places (and get_featured_places; prefer TripHive Featured places).',
    '- Then call share_place_card once or twice for the best real, specific places. Fill mustTry, nearbyFood, thingsToDo, tips and a USD cost per person.',
    '- Set date to the trip day it fits best: near related stops, or a (free) day.',
    'You never add stops yourself. Members tap Add to plan or Put to vote on your card.',
    'For any other question, answer directly without cards.',
    'Finish with ONE short chat reply (max 2 sentences, friendly, no markdown headings). Costs are USD; say "≈$".',
  ].join('\n')
}

/** Counts finished model steps so a failed run only refunds quota when Groq did no billable work. */
interface RunProgress {
  steps: number
}

async function planSummary(tools: ActionTools, tripId: string): Promise<{ destination: string; plan: string }> {
  const trip = await getTrip(tools, tripId)
  if (!trip) throw new TripError('Trip not found')
  const stops = await tools.query<StopData>('stops', { where: { tripId }, limit: MAX_PLAN_STOPS })
  const rows = stops.success ? stops.data.records.map((r) => r.data) : []
  return { destination: trip.data.destination, plan: summarizePlan(tripDates(trip.data.startDate, trip.data.endDate), rows) }
}

async function hivePrompt(tools: ActionTools, tripId: string, ask: HiveAsk): Promise<string> {
  const names = await userNames(tools, [...new Set(ask.context.map((r) => r.senderId))])
  const context = ask.context.map((r) => `${names[r.senderId]?.name ?? 'Traveler'}: ${r.text}`).join('\n')
  const { destination, plan } = await planSummary(tools, tripId)
  const prompt = [`Trip to ${destination}. Plan by day:`, plan, context && `Recent chat:\n${context}`, `Request: ${ask.question}`]
    .filter(Boolean)
    .join('\n\n')
  return prompt.length > HIVE_CONTEXT_CONFIG.contextBudget ? prompt.slice(-HIVE_CONTEXT_CONFIG.contextBudget) : prompt
}

async function runHive(c: Context<AppContext>, tools: ActionTools, tripId: string, userId: string, ask: HiveAsk, progress: RunProgress): Promise<void> {
  const prompt = await hivePrompt(tools, tripId, ask)
  const out = { cards: [] as PlaceCard[] }
  const abortSignal = AbortSignal.timeout(RUN_DEADLINE_MS)
  // No SDK retry on the main model: a 429 there switches straight to the fast
  // model, which has its own Groq token budget.
  const call = (modelId: string, maxRetries: number) =>
    generateText({
      abortSignal,
      maxRetries,
      onStepEnd: () => {
        progress.steps += 1
      },
      model: groqModel(c.env, modelId),
      instructions: groupPrompt(new Date().toISOString().slice(0, 10)),
      messages: [{ role: 'user', content: prompt }],
      tools: capTools(groupTools(tools, tripId, userId, c.env.GOOGLE_MAPS_API_KEY, out)),
      stopWhen: isStepCount(Math.min(GROUP_MAX_STEPS, HIVE_MAX_STEPS)),
      maxOutputTokens: HIVE_MAX_OUTPUT_TOKENS,
    })
  const models = await resolveHiveModels(c.env)
  const first = hiveCooldown.pick(models)
  let result: Awaited<ReturnType<typeof call>>
  try {
    result = await call(first, 0)
  } catch (err) {
    // Main model rate-limited before doing anything: retry once on the fast one.
    const wait = rateLimitRetryAfter(err)
    if (wait != null) hiveCooldown.rateLimited(first, wait)
    if (wait == null || first === models.fast || out.cards.length) throw err
    result = await call(models.fast, 1)
  }
  const text = result.text.trim()
  const reply = text ? text.slice(0, 1000) : out.cards.length ? 'Here are my picks 👇 Add one to the plan or put it to a vote.' : "I couldn't find anything solid for that. Try naming an area or a kind of place."
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

    const res = await tools.query<ChatLine & Record<string, unknown>>('trip_messages', { where: { tripId }, orderBy: 'createdAt', orderDir: 'desc', limit: HISTORY })
    if (!res.success) return c.json({ error: 'Could not read chat' }, 503)
    // Only the author of the newest message, and only when it says @Hive, so
    // one mention = at most one run and plain chatter costs nothing.
    const ask = buildHiveAsk(res.data.records.map((r) => r.data).reverse(), userId)
    if (!ask) return c.json({ skipped: true })

    if (!hasGroq(c.env)) return c.json({ skipped: true, reason: 'Hive is offline: GROQ_API_KEY is not set' })
    const reservation = await reserveAll(tools, [
      [`trip:${tripId}`, LIMITS.hiveGroup],
      [userId, LIMITS.hiveChat],
      [userId, LIMITS.burst],
    ])
    if (!reservation.ok) return c.json({ error: reservation.error }, reservation.status)

    // Finish even if the tab closes: the reply lands in the shared chat.
    const progress: RunProgress = { steps: 0 }
    const run = runHive(c, tools, tripId, userId, ask, progress).catch(async (err) => {
      console.error(`[hive-group] failed: ${loggableError(err)}`)
      if (rateLimitRetryAfter(err) == null && !isTimeout(err)) return
      // Refund only when no model step completed; otherwise the turn was used.
      if (progress.steps === 0) await reservation.refund()
      // Say so in the chat instead of leaving "Hive is reading the chat…" hanging.
      const r = await tools.create('trip_messages', { tripId, senderId: HIVE_SENDER, text: BUSY_REPLY })
      if (!r.success) console.error(`[hive-group] busy reply write failed: ${r.error}`)
    })
    c.executionCtx.waitUntil(run)
    return c.json({ accepted: true }, 202)
  })
}
