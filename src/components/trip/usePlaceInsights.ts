/**
 * What TripHive already knows about a place: the latest Hive card shared for
 * it in the group chat, and TripHiver reviews of it from every trip.
 */
import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import type { PlaceCard } from '@/ai/hive-group'
import { placeKey, summarizeReviews, type PlaceReviewData, type ReviewSummary } from '@/lib/reviews'

type TripMsg = { tripId: string; cards?: PlaceCard[] }

export type CommunityReview = { id: string; userId: string; rating: number; text?: string; spentUsd?: number; createdAt?: string }
export type Community = ReviewSummary & { reviews: CommunityReview[]; quotes: string[] }

const MAX_QUOTES = 2

/** The Hive card shared for this place most recently, if any. */
export function useHiveCard(tripId: string, name: string): PlaceCard | undefined {
  const { records } = useQuery<TripMsg>('trip_messages', { where: { tripId } })
  return useMemo(() => {
    const key = placeKey(name, '')
    const cards = records.flatMap((m) => m.data.cards ?? [])
    return cards.slice().reverse().find((c) => placeKey(c.name, '') === key)
  }, [records, name])
}

export function useCommunity(name: string, destination: string): Community {
  const { records } = useQuery<PlaceReviewData>('place_reviews', { where: { placeKey: placeKey(name, destination) } })
  return useMemo(() => {
    const reviews = records
      .map((r) => ({ id: r.recordId, userId: r.data.userId, rating: r.data.rating, text: r.data.text?.trim() || undefined, spentUsd: r.data.spentUsd, createdAt: r.createdAt }))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    const quotes = reviews.map((r) => r.text).filter((t): t is string => !!t).slice(0, MAX_QUOTES)
    return { ...summarizeReviews(reviews), reviews, quotes }
  }, [records])
}
