import type { DayForecast } from '@/lib/planCheck'

export type Trip = {
  title: string
  destination: string
  startDate: string
  endDate: string
  teamId: string
  inviteCode: string
  lat?: number
  lng?: number
  forecast?: Record<string, DayForecast> | null
  forecastAt?: string
  visibility?: 'private' | 'public'
}

export type Stop = {
  tripId: string
  date: string
  start?: string
  end?: string
  title: string
  notes?: string
  address?: string
  url?: string
  category?: string
  lat?: number
  lng?: number
  costPerPerson?: number
  outdoor?: boolean | number
  fixedTime?: boolean | number
  source?: 'human' | 'ai'
  rating?: number
  ratingCount?: number
}

export type Pref = {
  tripId: string
  userId: string
  dailyBudget?: number
  pace?: string
  interests?: string
  dietary?: string
  wakeTime?: string
}

export type IssueRow = {
  tripId: string
  date: string
  type: string
  severity: 'warn' | 'error'
  message: string
  stopIds: string[]
}

export type Proposal = {
  tripId: string
  kind: 'add' | 'update' | 'remove'
  payload: { stop?: Partial<Stop>; stopId?: string; patch?: Partial<Stop> }
  summary: string
  reason: string
  sources: string[]
  status: 'pending' | 'accepted' | 'rejected' | 'stale'
  votes: Record<string, 1 | -1>
  proposedFor: string
}

export type Member = { teamId: string; userId: string; status: string; role: 'owner' | 'member' }

export type Activity = { tripId: string; actorId: string; text: string }

export const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  food: { label: 'Food', emoji: '🍽️', color: '#ea580c' },
  sight: { label: 'Sight', emoji: '🏛️', color: '#2563eb' },
  activity: { label: 'Activity', emoji: '🎟️', color: '#7c3aed' },
  stay: { label: 'Stay', emoji: '🛏️', color: '#0f766e' },
  transport: { label: 'Transport', emoji: '🚆', color: '#475569' },
  other: { label: 'Other', emoji: '📍', color: '#a16207' },
}
