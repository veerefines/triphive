/** Pure helpers for the People directory: who is listed, and search/filter. */

export interface DirectoryProfile {
  userId: string
  displayName?: string
  homeCity?: string
  bio?: string
  travelStyle?: string
  interests?: string[]
  languages?: string
  isPublic?: number | boolean
}

export interface PeopleFilter {
  me?: string
  query?: string
  interest?: string | null
}

/** Stored as a number column (1/0); older rows may lack it entirely. */
export function isPublicProfile(p: Pick<DirectoryProfile, 'isPublic'>): boolean {
  return p.isPublic === true || p.isPublic === 1
}

function haystack(p: DirectoryProfile): string {
  return [p.displayName, p.homeCity, p.bio, p.travelStyle, p.languages, ...(p.interests ?? [])].filter(Boolean).join(' ').toLowerCase()
}

/** Public profiles other than mine that match the free-text query and interest. */
export function filterPeople<T extends DirectoryProfile>(profiles: readonly T[], filter: PeopleFilter): T[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  return profiles.filter((p) => {
    if (!isPublicProfile(p) || p.userId === filter.me) return false
    if (filter.interest && !(p.interests ?? []).includes(filter.interest)) return false
    return !query || haystack(p).includes(query)
  })
}
