/**
 * Scheduled tasks — run by AppCronRoom (worker.ts).
 *
 * weather-watch: every morning, for trips starting within the 5-day forecast
 * window, refresh the forecast and re-run Plan Doctor. If a NEW rain conflict
 * appears (an outdoor stop on a now-rainy day), email the trip's travelers.
 * Runs as the app owner through the same trip service the actions use.
 */
import type { CronTask } from 'deepspace/worker'
import type { Env } from '../worker'
import { createActionTools } from './server/action-routes'
import { listMembers, logActivity, refreshWeather, runPlanCheck, userNames, type TripData } from './server/trips'

export const tasks: CronTask[] = [{ name: 'weather-watch', schedule: '0 7 * * *', timezone: 'UTC' }]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name === 'weather-watch') await weatherWatch(env)
}

async function weatherWatch(env: Env) {
  const tools = createActionTools(env, env.OWNER_USER_ID, env.APP_OWNER_JWT)
  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
  const all = await tools.query<TripData>('trips', { limit: 500 })
  if (!all.success) throw new Error(`trips query failed: ${all.error}`)
  const upcoming = all.data.records.filter((t) => t.data.endDate >= today && t.data.startDate <= horizon)

  for (const trip of upcoming) {
    try {
      const before = await tools.query<{ type: string; message: string }>('issues', { where: { tripId: trip.recordId, type: 'rain' }, limit: 50 })
      const known = new Set(before.success ? before.data.records.map((r) => r.data.message) : [])
      await refreshWeather(tools, trip.recordId)
      const issues = await runPlanCheck(tools, trip.recordId)
      const fresh = issues.filter((i) => i.type === 'rain' && !known.has(i.message))
      if (fresh.length === 0) continue

      await logActivity(tools, trip.recordId, 'hive', `spotted rain on ${fresh.map((i) => i.date).join(', ')} — check outdoor plans`)
      const members = await listMembers(tools, trip.recordId)
      const names = await userNames(tools, members.map((m) => m.data.userId))
      for (const { email } of Object.values(names)) {
        if (!email) continue
        await tools.integration('email/send', {
          to: email,
          subject: `Rain alert for ${trip.data.title}`,
          text: `${fresh.map((i) => `• ${i.message}`).join('\n')}\n\nOpen TripHive and ask Hive for an indoor swap.`,
        })
      }
    } catch (err) {
      console.error(`[cron] weather-watch trip=${trip.recordId}: ${(err as Error).message}`)
    }
  }
}
