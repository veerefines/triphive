/**
 * Pure helpers that turn a group chat into a small `@Hive` request: only the
 * mentioning message plus a short tail of human context, never the whole chat.
 */
import { isHiveMention, stripHiveMention } from '../lib/mention.js'

export const CONTEXT_LINES = 3
const CONTEXT_LINE_CHARS = 200
const MIN_QUESTION_LENGTH = 4
const HIVE_SENDER = 'hive'

export interface ChatLine {
  senderId: string
  text: string
}

export interface HiveAsk {
  question: string
  context: ChatLine[]
}

/** The request Hive should answer, or null when the newest message is not the caller's @Hive mention. */
export function buildHiveAsk(rows: readonly ChatLine[], userId: string): HiveAsk | null {
  const last = rows.at(-1)
  if (!last || last.senderId !== userId || !isHiveMention(last.text)) return null
  const question = stripHiveMention(last.text)
  if (question.length < MIN_QUESTION_LENGTH) return null
  const context = rows
    .slice(0, -1)
    .filter((r) => r.senderId !== HIVE_SENDER)
    .slice(-CONTEXT_LINES)
    .map((r) => ({ senderId: r.senderId, text: r.text.slice(0, CONTEXT_LINE_CHARS) }))
  return { question, context }
}

export interface PlanStop {
  date: string
  title: string
  start?: string
}

/** One line per trip day: its stops in time order, or "(free)". */
export function summarizePlan(dates: readonly string[], stops: readonly PlanStop[]): string {
  return dates
    .map((d) => {
      const day = stops
        .filter((s) => s.date === d)
        .sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'))
        .map((s) => (s.start ? `${s.start} ${s.title}` : s.title))
      return `${d}: ${day.length ? day.join('; ') : '(free)'}`
    })
    .join('\n')
}
