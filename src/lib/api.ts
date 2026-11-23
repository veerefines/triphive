import { getAuthToken } from 'deepspace'

/** Call a server action (src/actions). Throws with the action's error text. */
export async function callAction<T = unknown>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string }
  if (!res.ok || body.success === false) throw new Error(body.error || `Request failed (${res.status})`)
  return body.data as T
}

/** Fetch the trip's itinerary PDF (planPdf action) and save it via a temporary link. */
export async function downloadPlanPdf(tripId: string): Promise<void> {
  const { base64, filename } = await callAction<{ base64: string; filename: string }>('planPdf', { tripId })
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
