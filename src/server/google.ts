/**
 * Google Places (New) Text Search — real Google Maps ratings, addresses and
 * coordinates. Optional: active only when the owner sets the secret
 *   npx deepspace secrets set GOOGLE_MAPS_API_KEY=...
 * The DeepSpace catalog's Google Maps routes (serpapi/places-search,
 * dataforseo maps) were unavailable during development (upstream quota /
 * credit reservation), so this calls Google directly from the worker. The key
 * never reaches the browser.
 */
export interface GooglePlace {
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  ratingCount?: number
  mapsUrl?: string
  kind?: string
  openNow?: boolean
  priceLevel?: string
}

const FIELDS = [
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.primaryTypeDisplayName',
  'places.currentOpeningHours.openNow',
  'places.priceLevel',
].join(',')

export async function googlePlacesSearch(
  apiKey: string | undefined,
  query: string,
  near?: { lat?: number; lng?: number },
  max = 3,
): Promise<GooglePlace[] | null> {
  if (!apiKey) return null
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: Math.min(10, Math.max(1, max)) }
  if (typeof near?.lat === 'number' && typeof near?.lng === 'number') {
    body.locationBias = { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 40_000 } }
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`[google] places search ${res.status}: ${await googleErrorReason(res)}`)
    return null
  }
  const data = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string }
      formattedAddress?: string
      location?: { latitude: number; longitude: number }
      rating?: number
      userRatingCount?: number
      googleMapsUri?: string
      primaryTypeDisplayName?: { text?: string }
      currentOpeningHours?: { openNow?: boolean }
      priceLevel?: string
    }>
  }
  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      name: p.displayName?.text ?? query,
      address: p.formattedAddress ?? '',
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      rating: p.rating,
      ratingCount: p.userRatingCount,
      mapsUrl: p.googleMapsUri,
      kind: p.primaryTypeDisplayName?.text,
      openNow: p.currentOpeningHours?.openNow,
      priceLevel: p.priceLevel,
    }))
}

/**
 * Google's own reason for a failed call (e.g. "API_KEY_INVALID",
 * "SERVICE_DISABLED"), for logs. Google error bodies never echo the key.
 */
export async function googleErrorReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { status?: string; message?: string; details?: Array<{ reason?: string }> } }
    const reason = body.error?.details?.find((d) => d.reason)?.reason
    return [body.error?.status, reason, body.error?.message?.slice(0, 160)].filter(Boolean).join(' | ') || 'no reason given'
  } catch {
    return 'unreadable error body'
  }
}
