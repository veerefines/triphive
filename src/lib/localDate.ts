/**
 * Calendar dates in the viewer's own timezone. `toISOString()` gives the UTC
 * day, which is a day off in the evening west of UTC and in the morning east
 * of it, so trip countdowns and date presets must use these instead.
 */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD of `d` in local time. */
export function localIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD of `days` local days after `d`; `d` is not changed. */
export function addLocalDays(d: Date, days: number): string {
  return localIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}
