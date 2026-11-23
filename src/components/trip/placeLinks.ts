/** Google Maps links for a stop: directions to its pin, or a search by name. */
type LinkStop = { title: string; lat?: number; lng?: number }

export function mapsLinks(stop: LinkStop, destination: string): { directions: string; open: string } {
  const hasPoint = typeof stop.lat === 'number' && typeof stop.lng === 'number'
  const where = hasPoint ? `${stop.lat},${stop.lng}` : `${stop.title}, ${destination}`
  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`,
    open: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.title}, ${destination}`)}`,
  }
}
