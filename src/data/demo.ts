/**
 * Demo world seeded by Settings → Demo data (owner only, src/server/demo.ts).
 *
 * Plain typed data, no randomness: three persona travelers, four trips with
 * real coordinates, reviews, group chat and join requests. `ME` stands for
 * whoever runs the seed (the app owner); dates are day offsets from the seed
 * day so the trips are always upcoming.
 */

export const ME = '@me'
export const PERSONAS = {
  priya: 'demo_priya',
  marco: 'demo_marco',
  aiko: 'demo_aiko',
} as const

export type DemoUser = typeof ME | (typeof PERSONAS)[keyof typeof PERSONAS]
export type DemoCategory = 'food' | 'sight' | 'activity' | 'stay' | 'transport' | 'other'

export type DemoProfile = {
  userId: DemoUser
  displayName: string
  avatarEmoji: string
  homeCity: string
  bio: string
  travelStyle: string
  interests: string[]
  languages: string
}

export type DemoStop = {
  day: number
  start: string
  end: string
  title: string
  category: DemoCategory
  lat: number
  lng: number
  cost: number
  outdoor?: boolean
  fixedTime?: boolean
  notes?: string
}

export type DemoPrefs = { dailyBudget: number; pace: 'chill' | 'balanced' | 'packed'; interests: string; dietary?: string; wakeTime: string }

export type DemoCard = {
  name: string
  why: string
  category: DemoCategory
  day: number
  lat: number
  lng: number
  rating: number
  ratingCount: number
  mustTry: string[]
  nearbyFood: string[]
  thingsToDo: string[]
  tips: string[]
  costPerPersonUsd: number
}

export type DemoRequest = {
  requester: DemoUser
  pitch: string
  status: 'pending' | 'accepted'
  replies: { from: DemoUser | 'system'; text: string }[]
}

export type DemoTrip = {
  key: string
  title: string
  destination: string
  lat: number
  lng: number
  startOffset: number
  days: number
  host: DemoUser
  members: DemoUser[]
  listing?: { description: string; vibes: string[]; openSpots: number }
  prefs: Partial<Record<DemoUser, DemoPrefs>>
  stops: DemoStop[]
  chat: { from: DemoUser; text: string }[]
  hive: { text: string; card: DemoCard }
  requests: DemoRequest[]
}

export type DemoReview = { by: DemoUser; place: string; destination: string; rating: number; text: string; spentUsd?: number }

export const DEMO_PROFILES: DemoProfile[] = [
  {
    userId: PERSONAS.priya,
    displayName: 'Priya Sharma',
    avatarEmoji: '🍛',
    homeCity: 'Mumbai, India',
    bio: 'Food-first traveler. I plan trips around markets and street stalls, then walk it all off. Always up for a sunrise hike.',
    travelStyle: 'Foodie',
    interests: ['Street food', 'Markets', 'Hiking', 'Tea'],
    languages: 'English, Hindi, Marathi',
  },
  {
    userId: PERSONAS.marco,
    displayName: 'Marco Rossi',
    avatarEmoji: '📸',
    homeCity: 'Milan, Italy',
    bio: 'Street photographer chasing golden hour. I know where the light hits the tiles. Happy to share shots with the group.',
    travelStyle: 'Photography',
    interests: ['Photography', 'Architecture', 'Wine', 'Live music'],
    languages: 'Italian, English, Spanish',
  },
  {
    userId: PERSONAS.aiko,
    displayName: 'Aiko Tanaka',
    avatarEmoji: '🥾',
    homeCity: 'Tokyo, Japan',
    bio: 'Weekday UX designer, weekend hiker. I host food crawls through my city and love showing people the small bars.',
    travelStyle: 'Adventure',
    interests: ['Hiking', 'Ramen', 'Design', 'Onsen'],
    languages: 'Japanese, English',
  },
]

const BALANCED: DemoPrefs = { dailyBudget: 90, pace: 'balanced', interests: 'food, views, history', wakeTime: '08:00' }

export const DEMO_TRIPS: DemoTrip[] = [
  {
    key: 'lisbon',
    title: 'Lisbon long weekend',
    destination: 'Lisbon, Portugal',
    lat: 38.7223,
    lng: -9.1393,
    startOffset: 18,
    days: 3,
    host: ME,
    members: [ME, PERSONAS.marco],
    listing: {
      description: 'Three slow days of pastéis, tiled alleys and fado. Looking for one or two easygoing people who like walking and eating.',
      vibes: ['Foodie', 'Culture', 'Photography'],
      openSpots: 2,
    },
    prefs: {
      [ME]: BALANCED,
      [PERSONAS.marco]: { dailyBudget: 110, pace: 'balanced', interests: 'photography, sunsets, wine', wakeTime: '07:30' },
    },
    stops: [
      { day: 0, start: '12:30', end: '14:00', title: 'Time Out Market Lisboa', category: 'food', lat: 38.7069, lng: -9.1459, cost: 18 },
      { day: 0, start: '15:00', end: '16:45', title: 'Miradouro de Santa Luzia', category: 'sight', lat: 38.7116, lng: -9.1301, cost: 0, outdoor: true, notes: 'Wander down through Alfama after.' },
      { day: 0, start: '17:00', end: '17:45', title: 'Tram 28', category: 'transport', lat: 38.7107, lng: -9.1335, cost: 3 },
      { day: 0, start: '20:00', end: '21:30', title: 'Taberna da Rua das Flores', category: 'food', lat: 38.7105, lng: -9.1438, cost: 30, notes: 'No reservations, so arrive early.' },
      { day: 1, start: '09:30', end: '10:30', title: 'Belém Tower', category: 'sight', lat: 38.6916, lng: -9.216, cost: 8, outdoor: true },
      { day: 1, start: '10:45', end: '12:15', title: 'Jerónimos Monastery', category: 'sight', lat: 38.6979, lng: -9.2068, cost: 12 },
      { day: 1, start: '12:20', end: '13:00', title: 'Pastéis de Belém', category: 'food', lat: 38.6975, lng: -9.2032, cost: 6 },
      { day: 1, start: '15:00', end: '17:00', title: 'LX Factory', category: 'activity', lat: 38.7036, lng: -9.1784, cost: 0 },
      { day: 1, start: '18:30', end: '19:30', title: 'Miradouro da Senhora do Monte', category: 'sight', lat: 38.7193, lng: -9.1327, cost: 0, outdoor: true },
      { day: 2, start: '10:00', end: '13:00', title: 'Pena Palace', category: 'sight', lat: 38.7876, lng: -9.3906, cost: 20, outdoor: true, fixedTime: true },
      { day: 2, start: '15:00', end: '16:30', title: 'Cabo da Roca', category: 'sight', lat: 38.7804, lng: -9.4989, cost: 0, outdoor: true },
      { day: 2, start: '21:00', end: '23:00', title: 'Clube de Fado', category: 'activity', lat: 38.7106, lng: -9.13, cost: 35 },
    ],
    chat: [
      { from: ME, text: 'Booked the flights! Landing Friday at 10:40.' },
      { from: PERSONAS.marco, text: 'Perfect. Santa Luzia is best around 4pm when the light is soft, so I moved it after lunch.' },
      { from: ME, text: 'Love it. Hive, anything near Belém we should not miss?' },
    ],
    hive: {
      text: 'Pastéis de Belém is the one to keep, and it is a 4 minute walk from Jerónimos, so it fits right after the monastery.',
      card: {
        name: 'Pastéis de Belém',
        why: 'The original custard tart bakery, open since 1837. Lines move fast, and the inside rooms are rarely full.',
        category: 'food',
        day: 1,
        lat: 38.6975,
        lng: -9.2032,
        rating: 4.6,
        ratingCount: 68000,
        mustTry: ['Pastel de nata', 'Bica (espresso)', 'Cinnamon on top'],
        nearbyFood: ['Enoteca de Belém', 'Nau Palatina'],
        thingsToDo: ['MAAT riverside walk', 'Padrão dos Descobrimentos'],
        tips: ['Skip the takeaway line and sit inside', 'Order a half dozen to share'],
        costPerPersonUsd: 6,
      },
    },
    requests: [
      {
        requester: PERSONAS.marco,
        pitch: 'Ciao! I shoot street photography and Lisbon has been on my list for years. Happy to send everyone the photos after.',
        status: 'accepted',
        replies: [
          { from: 'system', text: 'Request accepted. Chat is unlocked and the trip is shared. Welcome aboard! 🎉' },
          { from: PERSONAS.marco, text: 'Obrigado! I already have three sunset spots in mind.' },
        ],
      },
      {
        requester: PERSONAS.priya,
        pitch: 'Hi! Foodie from Mumbai here. I would love to join for the markets and the fado night, and I can share a list of bakeries.',
        status: 'pending',
        replies: [],
      },
    ],
  },
  {
    key: 'meghalaya',
    title: 'Meghalaya root bridges',
    destination: 'Meghalaya, India',
    lat: 25.467,
    lng: 91.3662,
    startOffset: 32,
    days: 3,
    host: PERSONAS.priya,
    members: [PERSONAS.priya, ME, PERSONAS.aiko],
    prefs: {
      [PERSONAS.priya]: { dailyBudget: 40, pace: 'packed', interests: 'hiking, local food', dietary: 'vegetarian', wakeTime: '06:00' },
      [ME]: BALANCED,
      [PERSONAS.aiko]: { dailyBudget: 50, pace: 'packed', interests: 'hiking, waterfalls', wakeTime: '05:30' },
    },
    stops: [
      { day: 0, start: '14:00', end: '15:00', title: 'Police Bazaar, Shillong', category: 'transport', lat: 25.5763, lng: 91.883, cost: 0 },
      { day: 0, start: '16:00', end: '17:00', title: "Ward's Lake", category: 'sight', lat: 25.5786, lng: 91.8865, cost: 1, outdoor: true },
      { day: 0, start: '19:30', end: '20:30', title: 'Jadoh at Police Bazaar', category: 'food', lat: 25.577, lng: 91.885, cost: 4 },
      { day: 1, start: '07:00', end: '12:00', title: 'Double Decker Living Root Bridge', category: 'activity', lat: 25.2531, lng: 91.6806, cost: 2, outdoor: true, notes: 'About 3,500 steps down from Tyrna. Bring water.' },
      { day: 1, start: '12:30', end: '14:00', title: 'Rainbow Falls', category: 'sight', lat: 25.2493, lng: 91.682, cost: 0, outdoor: true },
      { day: 1, start: '16:30', end: '17:30', title: 'Nohkalikai Falls', category: 'sight', lat: 25.2786, lng: 91.6849, cost: 1, outdoor: true },
      { day: 2, start: '09:30', end: '11:30', title: 'Mawlynnong Village', category: 'sight', lat: 25.2016, lng: 91.9161, cost: 1 },
      { day: 2, start: '12:30', end: '14:30', title: 'Umngot River, Dawki', category: 'activity', lat: 25.1868, lng: 92.0236, cost: 8, outdoor: true },
      { day: 2, start: '17:00', end: '18:00', title: 'Laitlum Canyons', category: 'sight', lat: 25.4583, lng: 91.9581, cost: 0, outdoor: true },
    ],
    chat: [
      { from: PERSONAS.priya, text: 'Root bridge day starts at 7. Trust me, the steps are easier before the heat.' },
      { from: PERSONAS.aiko, text: 'I am in! Packing my trail shoes.' },
      { from: ME, text: 'Can we fit Dawki on the last day? The clear water photos look unreal.' },
      { from: PERSONAS.priya, text: 'Done, added it after Mawlynnong.' },
    ],
    hive: {
      text: 'Umngot River is clearest from November to April, so your dates are ideal. Boats leave from Shnongpdeng, about 20 minutes from Dawki.',
      card: {
        name: 'Umngot River, Dawki',
        why: 'The water is so clear that the boats look like they are floating on air. Go before 2pm, before the wind ripples the surface.',
        category: 'activity',
        day: 2,
        lat: 25.1868,
        lng: 92.0236,
        rating: 4.5,
        ratingCount: 9200,
        mustTry: ['Boat ride at Shnongpdeng', 'Fresh river fish'],
        nearbyFood: ['Dawki market stalls'],
        thingsToDo: ['Suspension bridge', 'Cliff jumping (summer only)'],
        tips: ['Carry cash', 'Bargain for a shared boat'],
        costPerPersonUsd: 8,
      },
    },
    requests: [],
  },
  {
    key: 'tokyo',
    title: 'Tokyo food crawl',
    destination: 'Tokyo, Japan',
    lat: 35.6762,
    lng: 139.6503,
    startOffset: 46,
    days: 3,
    host: PERSONAS.aiko,
    members: [PERSONAS.aiko, PERSONAS.priya],
    listing: {
      description: 'A local-led eating tour: early fish market, standing sushi, tiny Golden Gai bars. I know the spots tourists miss.',
      vibes: ['Foodie', 'Nightlife', 'Culture'],
      openSpots: 2,
    },
    prefs: {
      [PERSONAS.aiko]: { dailyBudget: 120, pace: 'packed', interests: 'ramen, izakaya, design', wakeTime: '07:00' },
      [PERSONAS.priya]: { dailyBudget: 100, pace: 'balanced', interests: 'street food, markets', dietary: 'vegetarian', wakeTime: '07:00' },
    },
    stops: [
      { day: 0, start: '08:00', end: '10:00', title: 'Tsukiji Outer Market', category: 'food', lat: 35.6654, lng: 139.7707, cost: 25 },
      { day: 0, start: '11:00', end: '13:00', title: 'teamLab Planets', category: 'activity', lat: 35.6491, lng: 139.7898, cost: 28, fixedTime: true },
      { day: 0, start: '18:00', end: '19:00', title: 'Fuunji Ramen', category: 'food', lat: 35.6869, lng: 139.6965, cost: 9 },
      { day: 0, start: '19:30', end: '21:00', title: 'Omoide Yokocho', category: 'food', lat: 35.693, lng: 139.6995, cost: 20 },
      { day: 1, start: '09:00', end: '10:00', title: 'Meiji Jingu', category: 'sight', lat: 35.6764, lng: 139.6993, cost: 0, outdoor: true },
      { day: 1, start: '10:30', end: '12:00', title: 'Takeshita Street', category: 'sight', lat: 35.6716, lng: 139.7031, cost: 10 },
      { day: 1, start: '17:00', end: '18:30', title: 'Shibuya Sky', category: 'sight', lat: 35.6585, lng: 139.7024, cost: 15, fixedTime: true },
      { day: 1, start: '19:00', end: '20:00', title: 'Uogashi Nihon-Ichi', category: 'food', lat: 35.6595, lng: 139.6988, cost: 20 },
      { day: 2, start: '09:00', end: '10:30', title: 'Senso-ji', category: 'sight', lat: 35.7148, lng: 139.7967, cost: 0 },
      { day: 2, start: '10:30', end: '11:30', title: 'Nakamise Shopping Street', category: 'food', lat: 35.7119, lng: 139.7965, cost: 10 },
      { day: 2, start: '13:00', end: '14:30', title: 'Isetan Shinjuku Depachika', category: 'food', lat: 35.6918, lng: 139.7046, cost: 15 },
      { day: 2, start: '21:00', end: '23:00', title: 'Golden Gai', category: 'food', lat: 35.694, lng: 139.7046, cost: 25 },
    ],
    chat: [
      { from: PERSONAS.aiko, text: 'Fuunji line is shorter right at 6pm. I put it before Omoide Yokocho.' },
      { from: PERSONAS.priya, text: 'Vegetarian options at Tsukiji?' },
      { from: PERSONAS.aiko, text: 'Tamagoyaki and the strawberry daifuku stalls. Hive can find more.' },
    ],
    hive: {
      text: 'Tsukiji Outer Market has plenty for Priya: tamagoyaki, grilled mochi and fruit daifuku. Most stalls close by 2pm, so the 8am slot is right.',
      card: {
        name: 'Tsukiji Outer Market',
        why: 'Around 400 stalls and tiny restaurants. Go early on a weekday, before the tour groups arrive.',
        category: 'food',
        day: 0,
        lat: 35.6654,
        lng: 139.7707,
        rating: 4.4,
        ratingCount: 41000,
        mustTry: ['Tamagoyaki', 'Strawberry daifuku', 'Tuna nigiri'],
        nearbyFood: ['Sushi Dai', 'Kitsuneya'],
        thingsToDo: ['Hama-rikyu Gardens', 'Namiyoke Shrine'],
        tips: ['Cash only at most stalls', 'Eat at the stall, not while walking'],
        costPerPersonUsd: 25,
      },
    },
    requests: [
      {
        requester: ME,
        pitch: 'Hi Aiko! A local-led food crawl sounds perfect. I eat everything and I am happy to split costs.',
        status: 'pending',
        replies: [],
      },
    ],
  },
  {
    key: 'barcelona',
    title: 'Barcelona & tapas',
    destination: 'Barcelona, Spain',
    lat: 41.3874,
    lng: 2.1686,
    startOffset: 74,
    days: 3,
    host: PERSONAS.marco,
    members: [PERSONAS.marco, PERSONAS.aiko],
    listing: {
      description: 'Gaudí in the morning, tapas bars at night, a beach afternoon in between. Three spots open for fun, low-drama people.',
      vibes: ['Foodie', 'Culture', 'Nightlife'],
      openSpots: 3,
    },
    prefs: {
      [PERSONAS.marco]: { dailyBudget: 130, pace: 'balanced', interests: 'architecture, tapas, wine', wakeTime: '08:30' },
      [PERSONAS.aiko]: { dailyBudget: 100, pace: 'balanced', interests: 'design, beach, hiking', wakeTime: '07:30' },
    },
    stops: [
      { day: 0, start: '10:00', end: '11:00', title: 'La Boqueria', category: 'food', lat: 41.3817, lng: 2.1716, cost: 15 },
      { day: 0, start: '11:30', end: '13:00', title: 'Gothic Quarter', category: 'sight', lat: 41.3833, lng: 2.1761, cost: 0 },
      { day: 0, start: '13:30', end: '15:00', title: 'El Xampanyet', category: 'food', lat: 41.3842, lng: 2.1814, cost: 22 },
      { day: 0, start: '16:00', end: '17:30', title: 'Sagrada Família', category: 'sight', lat: 41.4036, lng: 2.1744, cost: 26, fixedTime: true },
      { day: 1, start: '09:30', end: '11:00', title: 'Park Güell', category: 'sight', lat: 41.4145, lng: 2.1527, cost: 10, outdoor: true, fixedTime: true },
      { day: 1, start: '11:30', end: '12:30', title: 'Bunkers del Carmel', category: 'sight', lat: 41.4192, lng: 2.1617, cost: 0, outdoor: true },
      { day: 1, start: '20:30', end: '22:00', title: 'Cal Pep', category: 'food', lat: 41.3839, lng: 2.1834, cost: 40 },
      { day: 2, start: '10:00', end: '12:00', title: 'Barceloneta Beach', category: 'activity', lat: 41.3784, lng: 2.1925, cost: 0, outdoor: true },
      { day: 2, start: '13:30', end: '15:00', title: 'Can Solé', category: 'food', lat: 41.3793, lng: 2.189, cost: 35 },
      { day: 2, start: '21:00', end: '22:00', title: 'Magic Fountain of Montjuïc', category: 'sight', lat: 41.3713, lng: 2.1517, cost: 0, outdoor: true },
    ],
    chat: [
      { from: PERSONAS.marco, text: 'Sagrada Família tickets are timed, so I locked 4pm. The stained glass glows then.' },
      { from: PERSONAS.aiko, text: 'Bunkers del Carmel right after Park Güell? It is a 15 minute walk.' },
      { from: PERSONAS.marco, text: 'Yes! Added.' },
    ],
    hive: {
      text: 'Cal Pep only seats at the counter and the line starts before opening. Arrive by 7:45pm for the 8:30 seating.',
      card: {
        name: 'Cal Pep',
        why: 'Counter-only tapas where the chef picks for you. Clams, tiny fried fish and the tortilla are the classics.',
        category: 'food',
        day: 1,
        lat: 41.3839,
        lng: 2.1834,
        rating: 4.5,
        ratingCount: 7600,
        mustTry: ['Cloïsses (clams)', 'Tortilla', 'Fried baby squid'],
        nearbyFood: ['El Xampanyet', 'Bar del Pla'],
        thingsToDo: ['Picasso Museum', 'Santa Maria del Mar'],
        tips: ['No reservations at the counter', 'Tell them your budget'],
        costPerPersonUsd: 40,
      },
    },
    requests: [],
  },
]

export const DEMO_REVIEWS: DemoReview[] = [
  { by: PERSONAS.marco, place: 'Time Out Market Lisboa', destination: 'Lisbon, Portugal', rating: 4, text: 'Go before 1pm or tables vanish. The croquetas stall is the move.', spentUsd: 20 },
  { by: PERSONAS.priya, place: 'Time Out Market Lisboa', destination: 'Lisbon, Portugal', rating: 5, text: 'A whole food tour under one roof. Try the bifana.', spentUsd: 16 },
  { by: PERSONAS.aiko, place: 'Pastéis de Belém', destination: 'Lisbon, Portugal', rating: 5, text: 'Still warm from the oven. Sit inside, the takeaway line is the long one.', spentUsd: 5 },
  { by: PERSONAS.priya, place: 'Pastéis de Belém', destination: 'Lisbon, Portugal', rating: 5, text: 'I had four. No regrets.', spentUsd: 7 },
  { by: PERSONAS.aiko, place: 'Pena Palace', destination: 'Lisbon, Portugal', rating: 4, text: 'Book the first slot. The fog lifts around 11 and the colors pop.', spentUsd: 22 },
  { by: PERSONAS.aiko, place: 'Double Decker Living Root Bridge', destination: 'Meghalaya, India', rating: 5, text: 'Brutal steps, magical bridge. Swim in the natural pool at the bottom.', spentUsd: 3 },
  { by: PERSONAS.marco, place: 'Umngot River, Dawki', destination: 'Meghalaya, India', rating: 4, text: 'Clear as glass before noon. Shared boats keep it cheap.', spentUsd: 9 },
  { by: PERSONAS.priya, place: 'Tsukiji Outer Market', destination: 'Tokyo, Japan', rating: 5, text: 'Tamagoyaki on a stick at 8am is a life goal.', spentUsd: 30 },
  { by: PERSONAS.marco, place: 'Fuunji Ramen', destination: 'Tokyo, Japan', rating: 5, text: 'Best tsukemen I have had. The line moves quickly.', spentUsd: 10 },
  { by: PERSONAS.marco, place: 'Omoide Yokocho', destination: 'Tokyo, Japan', rating: 4, text: 'Smoky, cramped and perfect for photos. Yakitori and a highball.', spentUsd: 22 },
  { by: PERSONAS.priya, place: 'La Boqueria', destination: 'Barcelona, Spain', rating: 4, text: 'Head to the back stalls, where the prices drop by half.', spentUsd: 14 },
  { by: PERSONAS.aiko, place: 'Cal Pep', destination: 'Barcelona, Spain', rating: 5, text: 'Let the chef choose. Best meal of the whole trip.', spentUsd: 45 },
]
