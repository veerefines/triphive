/**
 * TripHiver reviews: a stable key so reviews of the same place from different
 * trips meet, plus a summary used by place cards, Hive and the budget.
 */

export interface PlaceReviewData {
  placeKey: string
  name: string
  city: string
  userId: string
  tripId: string
  rating: number
  text?: string
  spentUsd?: number
}

export interface ReviewSummary {
  count: number
  avgRating: number | null
  avgSpentUsd: number | null
}

export const fold = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** First place word of a destination ("Lisbon, Portugal" → "lisbon"). */
export function cityOf(destination: string | undefined | null): string {
  return fold(String(destination ?? '').split(',')[0] ?? '')
}

/** Folded place name exactly as it appears in placeKey. */
export function placeName(name: string): string {
  return fold(name).slice(0, 80)
}

/** "Time Out Market" in "Lisbon, Portugal" → "time out market|lisbon". */
export function placeKey(name: string, destination: string | undefined | null): string {
  return `${placeName(name)}|${cityOf(destination)}`
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function summarizeReviews(reviews: ReadonlyArray<Pick<PlaceReviewData, 'rating' | 'spentUsd'>>): ReviewSummary {
  const rated = reviews.filter((r) => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5)
  const spent = rated.map((r) => r.spentUsd).filter((s): s is number => typeof s === 'number' && s >= 0)
  return {
    count: rated.length,
    avgRating: rated.length ? round1(rated.reduce((s, r) => s + r.rating, 0) / rated.length) : null,
    avgSpentUsd: spent.length ? Math.round(spent.reduce((s, v) => s + v, 0) / spent.length) : null,
  }
}
