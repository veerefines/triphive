/**
 * `@Hive` mentions in the group chat. Hive only answers messages that call it
 * by handle, so ordinary chatter never costs a model call.
 */

export const HIVE_HANDLE = '@Hive'

/** `@hive` not preceded by a word char (no emails) and not followed by one (no `@Hiveminds`). */
const MENTION = /(^|[^\w@])@hive(?![\w])[,:;.!]?/gi

export function isHiveMention(text: string): boolean {
  return new RegExp(MENTION.source, 'i').test(text)
}

export function stripHiveMention(text: string): string {
  return text.replace(MENTION, '$1').replace(/\s+/g, ' ').trim()
}
