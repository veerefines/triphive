/**
 * Hive plan check — deterministic itinerary checks.
 *
 * Pure function: same input, same issues. Runs in the worker (runPlanCheck
 * action, Hive's check_plan tool, weather cron) and is unit-tested in
 * planCheck.test.ts. Deliberately NOT an LLM: conflicts must be reliable and
 * explainable; the LLM's job is to propose fixes for them.
 */
import { haversineKm, hasCoords, pickMode, travelMinutes } from './geo'

export type StopLike = {
  id: string
  date: string // YYYY-MM-DD
  start?: string // HH:MM
  end?: string // HH:MM
  title: string
  category?: string
  lat?: number
  lng?: number
  costPerPerson?: number
  outdoor?: boolean | number
  address?: string
}

export type PrefLike = {
  userId: string
  name?: string
  dailyBudget?: number
  pace?: 'chill' | 'balanced' | 'packed' | string
  wakeTime?: string
}

export type DayForecast = {
  min: number
  max: number
  desc: string
  rain: boolean
}

export type TripLike = {
  startDate: string
  endDate: string
  forecast?: Record<string, DayForecast> | null
}

export type IssueType =
  | 'overlap'
  | 'travel'
  | 'outside-dates'
  | 'overloaded'
  | 'meal-gap'
  | 'rain'
  | 'budget'
  | 'duplicate'
  | 'early-start'

export interface Issue {
  date: string
  type: IssueType
  severity: 'warn' | 'error'
  message: string
  stopIds: string[]
}

/** Max timed stops per day for a pace. */
export const PACE_LIMIT: Record<string, number> = { chill: 3, balanced: 5, packed: 8 }
const DEFAULT_DURATION_MIN = 60

export function toMinutes(hhmm?: string): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function endOf(s: StopLike): number | null {
  const start = toMinutes(s.start)
  if (start == null) return null
  return toMinutes(s.end) ?? start + DEFAULT_DURATION_MIN
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Sort a day's stops: timed ones by start, untimed last (stable). */
export function sortDay<T extends StopLike>(stops: T[]): T[] {
  return [...stops].sort((a, b) => {
    const ta = toMinutes(a.start)
    const tb = toMinutes(b.start)
    if (ta == null && tb == null) return 0
    if (ta == null) return 1
    if (tb == null) return -1
    return ta - tb
  })
}

export function groupByDate<T extends StopLike>(stops: T[]): Map<string, T[]> {
  const days = new Map<string, T[]>()
  for (const s of stops) {
    const list = days.get(s.date) ?? []
    list.push(s)
    days.set(s.date, list)
  }
  for (const [d, list] of days) days.set(d, sortDay(list))
  return days
}

export function checkPlan(trip: TripLike, stops: StopLike[], prefs: PrefLike[] = []): Issue[] {
  const issues: Issue[] = []
  const days = groupByDate(stops)

  // Group constraints = the most restrictive member.
  const paces = prefs.map((p) => p.pace).filter((p): p is string => !!p && p in PACE_LIMIT)
  const slowest = paces.sort((a, b) => PACE_LIMIT[a] - PACE_LIMIT[b])[0]
  const budgets = prefs.filter((p) => typeof p.dailyBudget === 'number' && p.dailyBudget > 0)
  const tightest = budgets.sort((a, b) => (a.dailyBudget ?? 0) - (b.dailyBudget ?? 0))[0]
  const wakes = prefs
    .map((p) => ({ p, m: toMinutes(p.wakeTime) }))
    .filter((x): x is { p: PrefLike; m: number } => x.m != null)
    .sort((a, b) => b.m - a.m)
  const latestRiser = wakes[0]

  // Duplicates across the whole trip.
  const seen = new Map<string, StopLike>()
  for (const s of stops) {
    const key = normTitle(s.title)
    if (!key) continue
    const prev = seen.get(key)
    if (prev) {
      issues.push({
        date: s.date,
        type: 'duplicate',
        severity: 'warn',
        message: `"${s.title}" is planned twice (${prev.date} and ${s.date}).`,
        stopIds: [prev.id, s.id],
      })
    } else seen.set(key, s)
  }

  for (const [date, list] of days) {
    // Outside trip dates.
    if (date < trip.startDate || date > trip.endDate) {
      issues.push({
        date,
        type: 'outside-dates',
        severity: 'error',
        message: `${list.length} stop(s) on ${date}, outside the trip (${trip.startDate} → ${trip.endDate}).`,
        stopIds: list.map((s) => s.id),
      })
    }

    const timed = list.filter((s) => toMinutes(s.start) != null)

    // Overlaps + travel feasibility between consecutive timed stops.
    for (let i = 0; i < timed.length - 1; i++) {
      const a = timed[i]
      const b = timed[i + 1]
      const aEnd = endOf(a)!
      const bStart = toMinutes(b.start)!
      if (bStart < aEnd) {
        issues.push({
          date,
          type: 'overlap',
          severity: 'error',
          message: `"${a.title}" (until ${fromMinutes(aEnd)}) overlaps "${b.title}" (starts ${b.start}).`,
          stopIds: [a.id, b.id],
        })
        continue
      }
      if (hasCoords(a) && hasCoords(b)) {
        const km = haversineKm(a, b)
        const mode = pickMode(km)
        const need = travelMinutes(km, mode)
        const gap = bStart - aEnd
        if (need > gap) {
          issues.push({
            date,
            type: 'travel',
            severity: need - gap > 15 ? 'error' : 'warn',
            message: `${km.toFixed(1)} km from "${a.title}" to "${b.title}" needs ~${need} min by ${mode}, but only ${gap} min is free.`,
            stopIds: [a.id, b.id],
          })
        }
      }
    }

    // Pace.
    if (slowest && timed.length > PACE_LIMIT[slowest]) {
      issues.push({
        date,
        type: 'overloaded',
        severity: 'warn',
        message: `${timed.length} timed stops on ${date}; someone in the group prefers a ${slowest} pace (max ${PACE_LIMIT[slowest]}).`,
        stopIds: timed.map((s) => s.id),
      })
    }

    // Early start vs latest riser.
    if (latestRiser && timed.length) {
      const first = timed[0]
      const firstStart = toMinutes(first.start)!
      if (firstStart < latestRiser.m) {
        issues.push({
          date,
          type: 'early-start',
          severity: 'warn',
          message: `"${first.title}" starts ${first.start}, before ${latestRiser.p.name ?? 'a member'} is usually up (${latestRiser.p.wakeTime}).`,
          stopIds: [first.id],
        })
      }
    }

    // Meal gaps: only judge days that actually span the window.
    const meals: Array<[string, number, number]> = [
      ['lunch', 11 * 60 + 30, 14 * 60 + 30],
      ['dinner', 18 * 60, 21 * 60],
    ]
    if (timed.length >= 2) {
      const dayStart = toMinutes(timed[0].start)!
      const dayEnd = Math.max(...timed.map((s) => endOf(s)!))
      for (const [label, from, to] of meals) {
        if (dayStart > from || dayEnd < to) continue
        const hasFood = list.some((s) => {
          if (s.category !== 'food') return false
          const st = toMinutes(s.start)
          return st == null || (st >= from - 30 && st <= to)
        })
        if (!hasFood) {
          issues.push({
            date,
            type: 'meal-gap',
            severity: 'warn',
            message: `No ${label} stop between ${fromMinutes(from)} and ${fromMinutes(to)} on ${date}.`,
            stopIds: [],
          })
        }
      }
    }

    // Rain vs outdoor stops.
    const fc = trip.forecast?.[date]
    if (fc?.rain) {
      const outdoor = list.filter((s) => s.outdoor)
      if (outdoor.length) {
        issues.push({
          date,
          type: 'rain',
          severity: 'warn',
          message: `Rain forecast on ${date} (${fc.desc}); ${outdoor.length} outdoor stop(s): ${outdoor.map((s) => s.title).join(', ')}.`,
          stopIds: outdoor.map((s) => s.id),
        })
      }
    }

    // Budget.
    if (tightest) {
      const spend = list.reduce((sum, s) => sum + (s.costPerPerson ?? 0), 0)
      if (spend > (tightest.dailyBudget ?? 0)) {
        issues.push({
          date,
          type: 'budget',
          severity: 'warn',
          message: `~$${spend}/person on ${date}, above ${tightest.name ?? 'a member'}'s daily budget of $${tightest.dailyBudget}.`,
          stopIds: list.filter((s) => (s.costPerPerson ?? 0) > 0).map((s) => s.id),
        })
      }
    }
  }

  return issues
}

/** Inclusive list of YYYY-MM-DD dates for a trip. Capped at 30 days. */
export function tripDates(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const d = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return out
  while (d <= end && out.length < 30) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Collapse a 3-hourly forecast into per-day summaries. */
export function summarizeForecast(
  entries: Array<{ dt: number; temp: number; description: string }>,
  tzOffsetSeconds = 0,
): Record<string, DayForecast> {
  const byDay = new Map<string, Array<{ temp: number; description: string; hour: number }>>()
  for (const e of entries) {
    const local = new Date((e.dt + tzOffsetSeconds) * 1000)
    const day = local.toISOString().slice(0, 10)
    const list = byDay.get(day) ?? []
    list.push({ temp: e.temp, description: e.description, hour: local.getUTCHours() })
    byDay.set(day, list)
  }
  const out: Record<string, DayForecast> = {}
  for (const [day, list] of byDay) {
    const daytime = list.filter((x) => x.hour >= 8 && x.hour <= 20)
    const sample = daytime.length ? daytime : list
    const rainy = sample.filter((x) => /rain|drizzle|thunder|storm|snow/i.test(x.description))
    const counts = new Map<string, number>()
    for (const x of sample) counts.set(x.description, (counts.get(x.description) ?? 0) + 1)
    const desc = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    out[day] = {
      min: Math.round(Math.min(...list.map((x) => x.temp))),
      max: Math.round(Math.max(...list.map((x) => x.temp))),
      desc: rainy.length ? rainy[0].description : desc,
      rain: rainy.length >= Math.max(1, Math.ceil(sample.length / 3)),
    }
  }
  return out
}
