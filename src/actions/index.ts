/**
 * Server actions — POST /api/actions/:name.
 *
 * Actions run RBAC-off, so every action that takes a tripId re-checks
 * membership via `requireMember` (src/server/trips.ts) before doing anything.
 */
import type { ActionContext, ActionHandler, ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  TripError,
  createTrip,
  geocodePlace,
  getTrip,
  joinTrip,
  listMembers,
  logActivity,
  refreshWeather,
  requireMember,
  runPlanCheck,
  toStopLike,
  userNames,
  voteOnProposal,
  type StopData,
} from '../server/trips'
import { groupByDate } from '../lib/planCheck'

/** Map thrown TripErrors to `{ success: false }`; let real bugs surface as 500. */
function safe(fn: (ctx: ActionContext<Env>) => Promise<unknown>): ActionHandler<Env> {
  return async (ctx) => {
    try {
      return { success: true, data: await fn(ctx) } as ActionResult
    } catch (err) {
      if (err instanceof TripError) return { success: false, error: err.message }
      throw err
    }
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export const actions: Record<string, ActionHandler<Env>> = {
  createTrip: safe(({ tools, userId, params }) => createTrip(tools, userId, params)),

  joinTrip: safe(({ tools, userId, params }) => joinTrip(tools, userId, params.code)),

  leaveTrip: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    const { members } = await requireMember(tools, tripId, userId)
    const me = members.find((m) => m.data.userId === userId)!
    if (me.data.role === 'owner') throw new TripError('The owner cannot leave; delete the trip instead')
    await tools.remove('team_members', me.recordId)
    await logActivity(tools, tripId, userId, 'left the trip')
    return { left: true }
  }),

  runPlanCheck: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    await requireMember(tools, tripId, userId)
    const issues = await runPlanCheck(tools, tripId)
    return { count: issues.length }
  }),

  refreshWeather: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    await requireMember(tools, tripId, userId)
    const forecast = await refreshWeather(tools, tripId)
    await runPlanCheck(tools, tripId)
    return { days: Object.keys(forecast).length }
  }),

  /** Place autocomplete for the add-stop form (OSM Nominatim, biased to trip). */
  findPlace: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    const { trip } = await requireMember(tools, tripId, userId)
    const query = str(params.query).trim().slice(0, 120)
    if (query.length < 2) return { places: [] }
    let places = await geocodePlace(query, trip.data)
    if (places.length === 0) places = await geocodePlace(`${query}, ${trip.data.destination}`)
    return { places }
  }),

  vote: safe(({ tools, userId, params }) =>
    voteOnProposal(tools, userId, str(params.proposalId), Number(params.value), params.force === true),
  ),

  deleteTrip: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    const trip = await getTrip(tools, tripId)
    if (!trip) throw new TripError('Trip not found')
    if (trip.createdBy !== userId) throw new TripError('Only the trip owner can delete it')
    for (const coll of ['stops', 'prefs', 'issues', 'proposals', 'activity'] as const) {
      for (let i = 0; i < 20; i++) {
        const r = await tools.deleteWhere(coll, { tripId }, 500)
        if (!r.success || (r.data as { deleted: number }).deleted < 500) break
      }
    }
    await tools.deleteWhere('team_members', { teamId: tripId }, 500)
    await tools.remove('trips', tripId)
    return { deleted: true }
  }),

  /** Email the itinerary to every member (DeepSpace email integration). */
  emailItinerary: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    const { trip, members } = await requireMember(tools, tripId, userId)
    const names = await userNames(tools, members.map((m) => m.data.userId))
    const to = Object.values(names).map((n) => n.email).filter((e): e is string => !!e)
    if (to.length === 0) throw new TripError('No member emails on file')

    const stops = await tools.query<StopData>('stops', { where: { tripId }, limit: 500 })
    if (!stops.success) throw new TripError('Could not load stops')
    const byDay = groupByDate(stops.data.records.map((s) => ({ ...toStopLike(s.recordId, s.data), url: s.data.url })))
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
    const t = trip.data
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px">
        <h1 style="margin:0">${escapeHtml(t.title)}</h1>
        <p style="color:#666">${escapeHtml(t.destination)} · ${t.startDate} → ${t.endDate} · ${members.length} travelers</p>
        ${days.map(([date, list]) => {
          const fc = t.forecast?.[date]
          return `<h3 style="margin-bottom:4px">${date}${fc ? ` <small style="color:#888">· ${fc.min}–${fc.max}°C ${escapeHtml(fc.desc)}</small>` : ''}</h3>
            <ul style="padding-left:18px;margin-top:0">${list.map((s) => `<li><b>${s.start ?? '—'}${s.end ? `–${s.end}` : ''}</b> ${escapeHtml(s.title)}${s.address ? ` <span style="color:#888">· ${escapeHtml(s.address.split(',').slice(0, 2).join(','))}</span>` : ''}${s.url ? ` · <a href="${escapeHtml(s.url)}">link</a>` : ''}</li>`).join('')}</ul>`
        }).join('')}
        <p style="color:#888;font-size:12px">Sent from TripHive by ${escapeHtml(names[userId]?.name ?? 'a member')}.</p>
      </div>`
    const r = await tools.integration('email/send', {
      to,
      subject: `Itinerary: ${t.title} (${t.startDate})`,
      html,
      reply_to: names[userId]?.email,
    })
    if (!r.success) throw new TripError(`Email failed: ${r.error}`)
    await logActivity(tools, tripId, userId, `emailed the itinerary to ${to.length} traveler(s)`)
    return { sent: to.length }
  }),

  /** Members list with display names (team_members rows only carry ids). */
  tripMembers: safe(async ({ tools, userId, params }) => {
    const tripId = str(params.tripId)
    await requireMember(tools, tripId, userId)
    const members = await listMembers(tools, tripId)
    const names = await userNames(tools, members.map((m) => m.data.userId))
    return {
      members: members.map((m) => ({ userId: m.data.userId, role: m.data.role, name: names[m.data.userId]?.name ?? 'Traveler' })),
    }
  }),
}

