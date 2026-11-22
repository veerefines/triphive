/** Only http(s) URLs may become links — blocks `javascript:`/`data:` hrefs from AI output or member-edited fields. */
export function safeHref(u: unknown): string | undefined {
  if (typeof u !== 'string' || !u) return undefined
  try {
    const x = new URL(u)
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : undefined
  } catch {
    return undefined
  }
}
