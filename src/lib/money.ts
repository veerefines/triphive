/**
 * Countries, currencies and price levels — a small, offline model so every
 * cost in TripHive has a sensible number even when no live data is around.
 *
 * Price index and per-unit costs are adapted from the open-source Wayfare
 * planner (github.com/MallankG/wayfare, services/agents/agents/estimates.py):
 * 1.0 ≈ Italy. All base prices are USD and are scaled by the index.
 */

export interface CountryInfo {
  code: string
  name: string
  currency: string
  /** Price level, 1.0 ≈ Italy. */
  index: number
  /** Share of day-to-day spend usually paid in cash (0–1). */
  cashShare: number
}

const C = (code: string, name: string, currency: string, index: number, cashShare: number): CountryInfo => ({
  code,
  name,
  currency,
  index,
  cashShare,
})

export const COUNTRIES: Record<string, CountryInfo> = {
  US: C('US', 'United States', 'USD', 1.3, 0.1),
  CA: C('CA', 'Canada', 'CAD', 1.15, 0.1),
  MX: C('MX', 'Mexico', 'MXN', 0.55, 0.45),
  BR: C('BR', 'Brazil', 'BRL', 0.55, 0.2),
  GB: C('GB', 'United Kingdom', 'GBP', 1.3, 0.05),
  IE: C('IE', 'Ireland', 'EUR', 1.25, 0.1),
  FR: C('FR', 'France', 'EUR', 1.15, 0.15),
  DE: C('DE', 'Germany', 'EUR', 1.1, 0.35),
  NL: C('NL', 'Netherlands', 'EUR', 1.2, 0.05),
  ES: C('ES', 'Spain', 'EUR', 0.9, 0.2),
  PT: C('PT', 'Portugal', 'EUR', 0.8, 0.2),
  IT: C('IT', 'Italy', 'EUR', 1.0, 0.25),
  GR: C('GR', 'Greece', 'EUR', 0.85, 0.35),
  CH: C('CH', 'Switzerland', 'CHF', 1.6, 0.15),
  AT: C('AT', 'Austria', 'EUR', 1.1, 0.3),
  CZ: C('CZ', 'Czechia', 'CZK', 0.7, 0.2),
  PL: C('PL', 'Poland', 'PLN', 0.65, 0.15),
  HU: C('HU', 'Hungary', 'HUF', 0.65, 0.25),
  SE: C('SE', 'Sweden', 'SEK', 1.2, 0.02),
  NO: C('NO', 'Norway', 'NOK', 1.45, 0.02),
  DK: C('DK', 'Denmark', 'DKK', 1.35, 0.03),
  IS: C('IS', 'Iceland', 'ISK', 1.6, 0.02),
  TR: C('TR', 'Türkiye', 'TRY', 0.5, 0.3),
  AE: C('AE', 'United Arab Emirates', 'AED', 1.2, 0.15),
  IN: C('IN', 'India', 'INR', 0.35, 0.5),
  NP: C('NP', 'Nepal', 'NPR', 0.35, 0.75),
  LK: C('LK', 'Sri Lanka', 'LKR', 0.4, 0.6),
  TH: C('TH', 'Thailand', 'THB', 0.5, 0.55),
  VN: C('VN', 'Vietnam', 'VND', 0.4, 0.65),
  ID: C('ID', 'Indonesia', 'IDR', 0.45, 0.55),
  MY: C('MY', 'Malaysia', 'MYR', 0.5, 0.35),
  SG: C('SG', 'Singapore', 'SGD', 1.3, 0.1),
  PH: C('PH', 'Philippines', 'PHP', 0.45, 0.6),
  CN: C('CN', 'China', 'CNY', 0.7, 0.1),
  HK: C('HK', 'Hong Kong', 'HKD', 1.25, 0.2),
  JP: C('JP', 'Japan', 'JPY', 1.0, 0.4),
  KR: C('KR', 'South Korea', 'KRW', 0.95, 0.1),
  AU: C('AU', 'Australia', 'AUD', 1.25, 0.1),
  NZ: C('NZ', 'New Zealand', 'NZD', 1.2, 0.1),
  ZA: C('ZA', 'South Africa', 'ZAR', 0.55, 0.3),
  EG: C('EG', 'Egypt', 'EGP', 0.35, 0.7),
  MA: C('MA', 'Morocco', 'MAD', 0.45, 0.7),
}

/** City / region / country words → ISO country. Lower-case, matched as whole words. */
const PLACE_WORDS: Array<[string, string]> = [
  ['new york', 'US'], ['nyc', 'US'], ['san francisco', 'US'], ['los angeles', 'US'], ['chicago', 'US'], ['miami', 'US'], ['seattle', 'US'], ['boston', 'US'], ['las vegas', 'US'], ['hawaii', 'US'], ['usa', 'US'], ['united states', 'US'],
  ['toronto', 'CA'], ['vancouver', 'CA'], ['montreal', 'CA'], ['canada', 'CA'],
  ['mexico', 'MX'], ['cancun', 'MX'], ['tulum', 'MX'], ['rio', 'BR'], ['sao paulo', 'BR'], ['brazil', 'BR'],
  ['london', 'GB'], ['edinburgh', 'GB'], ['manchester', 'GB'], ['uk', 'GB'], ['england', 'GB'], ['scotland', 'GB'], ['dublin', 'IE'], ['ireland', 'IE'],
  ['paris', 'FR'], ['nice', 'FR'], ['lyon', 'FR'], ['france', 'FR'], ['berlin', 'DE'], ['munich', 'DE'], ['hamburg', 'DE'], ['germany', 'DE'],
  ['amsterdam', 'NL'], ['netherlands', 'NL'], ['barcelona', 'ES'], ['madrid', 'ES'], ['seville', 'ES'], ['ibiza', 'ES'], ['spain', 'ES'],
  ['lisbon', 'PT'], ['lisboa', 'PT'], ['porto', 'PT'], ['portugal', 'PT'], ['rome', 'IT'], ['milan', 'IT'], ['florence', 'IT'], ['venice', 'IT'], ['naples', 'IT'], ['italy', 'IT'],
  ['athens', 'GR'], ['santorini', 'GR'], ['greece', 'GR'], ['zurich', 'CH'], ['geneva', 'CH'], ['switzerland', 'CH'], ['vienna', 'AT'], ['austria', 'AT'],
  ['prague', 'CZ'], ['krakow', 'PL'], ['warsaw', 'PL'], ['budapest', 'HU'], ['stockholm', 'SE'], ['oslo', 'NO'], ['copenhagen', 'DK'], ['reykjavik', 'IS'], ['iceland', 'IS'],
  ['istanbul', 'TR'], ['turkey', 'TR'], ['dubai', 'AE'], ['abu dhabi', 'AE'],
  ['mumbai', 'IN'], ['delhi', 'IN'], ['new delhi', 'IN'], ['bangalore', 'IN'], ['bengaluru', 'IN'], ['goa', 'IN'], ['jaipur', 'IN'], ['shillong', 'IN'], ['meghalaya', 'IN'], ['kerala', 'IN'], ['pune', 'IN'], ['india', 'IN'],
  ['kathmandu', 'NP'], ['nepal', 'NP'], ['colombo', 'LK'], ['sri lanka', 'LK'],
  ['bangkok', 'TH'], ['phuket', 'TH'], ['chiang mai', 'TH'], ['thailand', 'TH'], ['hanoi', 'VN'], ['ho chi minh', 'VN'], ['vietnam', 'VN'],
  ['bali', 'ID'], ['jakarta', 'ID'], ['indonesia', 'ID'], ['kuala lumpur', 'MY'], ['malaysia', 'MY'], ['singapore', 'SG'], ['manila', 'PH'], ['philippines', 'PH'],
  ['beijing', 'CN'], ['shanghai', 'CN'], ['china', 'CN'], ['hong kong', 'HK'], ['tokyo', 'JP'], ['kyoto', 'JP'], ['osaka', 'JP'], ['japan', 'JP'], ['seoul', 'KR'], ['busan', 'KR'], ['korea', 'KR'],
  ['sydney', 'AU'], ['melbourne', 'AU'], ['australia', 'AU'], ['auckland', 'NZ'], ['queenstown', 'NZ'], ['new zealand', 'NZ'],
  ['cape town', 'ZA'], ['johannesburg', 'ZA'], ['cairo', 'EG'], ['egypt', 'EG'], ['marrakech', 'MA'], ['morocco', 'MA'],
]

/** Best-guess country for a free-text place ("Lisbon, Portugal"). */
export function countryFor(place: string | undefined | null): CountryInfo | null {
  const text = ` ${(place ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]+/g, ' ')} `
  // Prefer the last match: "Paris, Texas, USA" → US; "Lisbon, Portugal" → PT.
  let best: { at: number; code: string } | null = null
  for (const [word, code] of PLACE_WORDS) {
    const at = text.lastIndexOf(` ${word} `)
    if (at >= 0 && (!best || at > best.at)) best = { at, code }
  }
  return best ? COUNTRIES[best.code] : null
}

/** Country from a BCP-47 locale's region ("en-IN" → IN). */
export function countryFromLocale(locale: string | undefined | null): CountryInfo | null {
  const region = (locale ?? '').split(/[-_]/)[1]?.toUpperCase()
  return region ? (COUNTRIES[region] ?? null) : null
}

/** Offline fallback USD rates (≈ Nov 2026) used when the live FX feed is unavailable. */
export const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, EUR: 0.91, GBP: 0.76, CHF: 0.84, CAD: 1.43, MXN: 19.1, BRL: 5.94, CZK: 22.3, PLN: 4.06, HUF: 340, SEK: 10.2, NOK: 9.75, DKK: 6.8,
  ISK: 125, TRY: 41, AED: 3.67, INR: 92.7, NPR: 148, LKR: 300, THB: 33, VND: 26300, IDR: 18260, MYR: 4.11, SGD: 1.29, PHP: 63.8,
  CNY: 6.68, HKD: 7.84, JPY: 158.6, KRW: 1339, AUD: 1.5, NZD: 1.82, ZAR: 17.6, EGP: 49, MAD: 9.2,
}

/** Convert an amount between currencies through USD rates (`rates[X]` = X per 1 USD). */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  const f = rates[from]
  const t = rates[to]
  if (!f || !t) return null
  return (amount / f) * t
}

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'ISK', 'INR', 'NPR', 'LKR', 'PHP', 'THB', 'CZK'])

/** Short money label: "€42", "₹3,900", "¥5,200". */
export function formatMoney(amount: number, currency: string): string {
  const digits = ZERO_DECIMAL.has(currency) || Math.abs(amount) >= 10 ? 0 : 2
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(amount)
  } catch {
    return `${Math.round(amount)} ${currency}`
  }
}

/** Round up to a "nice" cash amount you could actually withdraw. */
export function niceCash(amount: number): number {
  if (amount <= 0) return 0
  const mag = 10 ** Math.max(1, Math.floor(Math.log10(amount)) - 1)
  return Math.ceil(amount / mag) * mag
}
