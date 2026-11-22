/**
 * TripHive Featured places — a curated, in-repo list reviewed by the TripHive
 * team (changes go through code review, so nobody can self-feature).
 *
 * The perks are DEMO partner offers for this build exercise: no real
 * partnership exists yet. The UI labels them "Demo offer".
 */
export type FeaturedPlace = {
  id: string
  city: string
  name: string
  category: 'food' | 'sight' | 'activity' | 'stay'
  lat: number
  lng: number
  blurb: string
  perk: string
  priceFrom?: number
  priceWas?: number
  rating?: number
  verifiedBy: string
}

export const FEATURED: FeaturedPlace[] = [
  // Lisbon
  { id: 'lis-timeout', city: 'Lisbon', name: 'Time Out Market Lisboa', category: 'food', lat: 38.7069, lng: -9.1459, blurb: 'Forty stalls of the city’s best chefs under one roof. Great for groups that can’t agree.', perk: '10% off at partner stalls', priceFrom: 14, priceWas: 16, rating: 4.5, verifiedBy: 'Inês, TripHive Lisbon' },
  { id: 'lis-tram', city: 'Lisbon', name: 'Alfama sunset walk', category: 'activity', lat: 38.7118, lng: -9.1300, blurb: 'Small-group walk through Alfama ending at Miradouro de Santa Luzia for golden hour.', perk: 'Free ginjinha for TripHive groups', priceFrom: 18, priceWas: 22, rating: 4.8, verifiedBy: 'Inês, TripHive Lisbon' },
  { id: 'lis-pasteis', city: 'Lisbon', name: 'Pastéis de Belém', category: 'food', lat: 38.6975, lng: -9.2033, blurb: 'The original custard tarts since 1837. Go before 10am to skip the line.', perk: 'Skip-the-line window 9–10am', priceFrom: 2, rating: 4.6, verifiedBy: 'Inês, TripHive Lisbon' },
  // Barcelona
  { id: 'bcn-boqueria', city: 'Barcelona', name: 'Mercat de la Boqueria tapas crawl', category: 'food', lat: 41.3817, lng: 2.1716, blurb: 'Five counters, five bites, one local guide. Vegetarian route available.', perk: '15% off with code HIVE15', priceFrom: 42, priceWas: 49, rating: 4.7, verifiedBy: 'Marc, TripHive Barcelona' },
  { id: 'bcn-bunkers', city: 'Barcelona', name: 'Bunkers del Carmel', category: 'sight', lat: 41.4192, lng: 2.1617, blurb: 'The best free panorama of the city. Bring snacks for sunset.', perk: 'Free group picnic map', rating: 4.7, verifiedBy: 'Marc, TripHive Barcelona' },
  // Tokyo
  { id: 'tyo-omoide', city: 'Tokyo', name: 'Omoide Yokocho yakitori night', category: 'food', lat: 35.6938, lng: 139.6995, blurb: 'Tiny smoky bars in Shinjuku’s “Memory Lane”. A host books seats for groups of 4–6.', perk: 'First round on the house', priceFrom: 35, priceWas: 40, rating: 4.6, verifiedBy: 'Yuki, TripHive Tokyo' },
  { id: 'tyo-teamlab', city: 'Tokyo', name: 'teamLab Planets', category: 'activity', lat: 35.6491, lng: 139.7898, blurb: 'Walk-through digital art; book a morning slot to dodge crowds.', perk: '8% off group tickets', priceFrom: 26, priceWas: 28, rating: 4.6, verifiedBy: 'Yuki, TripHive Tokyo' },
  // Shillong / Meghalaya
  { id: 'shl-laitlum', city: 'Shillong', name: 'Laitlum Canyons sunrise', category: 'sight', lat: 25.4650, lng: 91.9530, blurb: 'Cloud-filled canyons at dawn. Our partner driver leaves Shillong at 4:30am.', perk: '₹300 off shared cab', priceFrom: 20, priceWas: 24, rating: 4.8, verifiedBy: 'Dapbiang, TripHive Meghalaya' },
  { id: 'shl-cafe', city: 'Shillong', name: 'Café Shillong', category: 'food', lat: 25.5764, lng: 91.8830, blurb: 'Live music nights and the best pork momos in Police Bazaar.', perk: 'Free dessert for TripHive groups', priceFrom: 8, rating: 4.4, verifiedBy: 'Dapbiang, TripHive Meghalaya' },
  // New York
  { id: 'nyc-highline', city: 'New York', name: 'High Line + Chelsea Market', category: 'activity', lat: 40.7480, lng: -74.0048, blurb: 'Elevated park walk ending in a food hall. Easy, free, and great for first days.', perk: 'Partner food-hall discount card', rating: 4.7, verifiedBy: 'Dana, TripHive NYC' },
  // Paris
  { id: 'par-canal', city: 'Paris', name: 'Canal Saint-Martin apéro', category: 'food', lat: 48.8710, lng: 2.3650, blurb: 'Locals’ sunset spot. We pre-pack cheese + wine baskets for groups.', perk: '12% off apéro baskets', priceFrom: 22, priceWas: 25, rating: 4.5, verifiedBy: 'Léa, TripHive Paris' },
]

/** Featured places within `radiusKm` of a point (or matching the city name). */
export function featuredNear(p: { lat?: number; lng?: number; destination?: string }, radiusKm = 60): FeaturedPlace[] {
  const name = (p.destination ?? '').toLowerCase()
  return FEATURED.filter((f) => {
    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      const dLat = ((f.lat - p.lat) * Math.PI) / 180
      const dLng = ((f.lng - p.lng) * Math.PI) / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((p.lat * Math.PI) / 180) * Math.cos((f.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
      if (6371 * 2 * Math.asin(Math.sqrt(a)) <= radiusKm) return true
    }
    return !!name && (name.includes(f.city.toLowerCase()) || f.city.toLowerCase().includes(name.split(',')[0].trim()))
  })
}
