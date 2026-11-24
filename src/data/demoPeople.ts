/**
 * Demo personas and the shared demo types. Personas never sign in; the seed
 * registers them as users so their names resolve, and lists every one of
 * them on People (isPublic: 1) so the directory is never empty.
 *
 * Travel styles and interests use the same vocabulary as the profile editor.
 */

export const ME = '@me'
export const PERSONAS = {
  priya: 'demo_priya',
  marco: 'demo_marco',
  aiko: 'demo_aiko',
  tenzin: 'demo_tenzin',
  maya: 'demo_maya',
  lukas: 'demo_lukas',
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
  isPublic: 1
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
  /** Group chat; the last line is an @Hive ask that `hive` answers with a card. */
  chat: { from: DemoUser; text: string }[]
  hive: { text: string; card: DemoCard }
  requests: DemoRequest[]
}

export type DemoReview = { by: DemoUser; place: string; destination: string; rating: number; text: string; spentUsd?: number }

export const DEMO_PROFILES: DemoProfile[] = [
  {
    userId: PERSONAS.priya,
    displayName: 'Priya Sharma',
    avatarEmoji: '🍜',
    homeCity: 'Mumbai, India',
    bio: 'Food-first traveler. I plan trips around markets and street stalls, then walk it all off. Always up for a sunrise hike.',
    travelStyle: 'Foodie',
    interests: ['Street food', 'Markets', 'Hiking', 'Coffee'],
    languages: 'English, Hindi, Marathi',
    isPublic: 1,
  },
  {
    userId: PERSONAS.marco,
    displayName: 'Marco Rossi',
    avatarEmoji: '📸',
    homeCity: 'Milan, Italy',
    bio: 'Street photographer chasing golden hour. I know where the light hits the tiles, and I share every shot with the group.',
    travelStyle: 'Go with the flow',
    interests: ['Photography', 'Architecture', 'Live music', 'Museums'],
    languages: 'Italian, English, Spanish',
    isPublic: 1,
  },
  {
    userId: PERSONAS.aiko,
    displayName: 'Aiko Tanaka',
    avatarEmoji: '🌸',
    homeCity: 'Tokyo, Japan',
    bio: 'Weekday UX designer, weekend hiker. I host food crawls through my city and love showing people the tiny bars.',
    travelStyle: 'Night owl',
    interests: ['Hiking', 'Street food', 'Architecture', 'Nightlife'],
    languages: 'Japanese, English',
    isPublic: 1,
  },
  {
    userId: PERSONAS.tenzin,
    displayName: 'Tenzin Wangchuk',
    avatarEmoji: '🗺️',
    homeCity: 'Thimphu, Bhutan',
    bio: 'Grew up below Dochula Pass. I lead small groups to monasteries and valley trails, slowly, with plenty of butter tea.',
    travelStyle: 'Planner',
    interests: ['Hiking', 'Wellness', 'Photography', 'Wildlife'],
    languages: 'Dzongkha, English, Hindi, Nepali',
    isPublic: 1,
  },
  {
    userId: PERSONAS.maya,
    displayName: 'Maya Alvarez',
    avatarEmoji: '🏄',
    homeCity: 'San Diego, USA',
    bio: 'Marine biologist and dawn-patrol surfer. Ask me about tide pools, fish tacos and the best place to watch the sunset.',
    travelStyle: 'Early bird',
    interests: ['Beaches', 'Wildlife', 'Street food', 'Live music'],
    languages: 'English, Spanish',
    isPublic: 1,
  },
  {
    userId: PERSONAS.lukas,
    displayName: 'Lukas Becker',
    avatarEmoji: '🎒',
    homeCity: 'Berlin, Germany',
    bio: 'On a long sabbatical, 14 countries so far. Easygoing, tidy, and happy to sort out the train tickets for everyone.',
    travelStyle: 'Budget backpacker',
    interests: ['Hiking', 'Nightlife', 'Markets', 'Coffee'],
    languages: 'German, English',
    isPublic: 1,
  },
]

export const BALANCED: DemoPrefs = { dailyBudget: 90, pace: 'balanced', interests: 'food, views, history', wakeTime: '08:00' }
