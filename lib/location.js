// Helpers that map a detected country to a sensible default currency and that
// orchestrate IP-based location detection on the client. Location data is
// fetched from the `/api/location` route (which proxies ipapi.co) and cached
// in localStorage for a day to stay within free API limits.

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export const LOCATION_CACHE_KEY = 'sheetinvoicer_location_cache_v1'
export const SMART_PREFS_KEY = 'sheetinvoicer_smart_prefs_v1'

// ISO 3166-1 alpha-2 country code -> ISO 4217 currency code.
export const COUNTRY_CURRENCY = {
  US: 'USD', EC: 'USD', SV: 'USD', PA: 'USD',
  CA: 'CAD',
  MX: 'MXN',
  GB: 'GBP',
  // Eurozone
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR',
  // Rest of Europe
  SE: 'SEK', DK: 'DKK', NO: 'NOK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  CH: 'CHF', TR: 'TRY', RU: 'RUB', UA: 'UAH',
  // Middle East
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', IL: 'ILS', BH: 'BHD', OM: 'OMR',
  // Asia Pacific
  AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', IN: 'INR', SG: 'SGD', MY: 'MYR',
  ID: 'IDR', PH: 'PHP', TH: 'THB', KR: 'KRW', HK: 'HKD', TW: 'TWD', VN: 'VND',
  // Latin America
  BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
  // Africa
  ZA: 'ZAR', NG: 'NGN', EG: 'EGP', KE: 'KES', MA: 'MAD',
}

function normalizeCountryCode(countryCode) {
  return typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : ''
}

/**
 * Maps a country code to its national currency, defaulting to USD.
 */
export function getCurrencyForCountry(countryCode) {
  const code = normalizeCountryCode(countryCode)
  return COUNTRY_CURRENCY[code] || 'USD'
}

/**
 * Reads the persisted smart-detection preferences (currency / tax / overrides).
 * Returns `null` when nothing has been stored yet or on parse errors.
 */
export function loadSmartPreferences() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SMART_PREFS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    window.localStorage.removeItem(SMART_PREFS_KEY)
    return null
  }
}

/**
 * Persists the smart-detection preferences so they are remembered across
 * sessions and pages.
 */
export function saveSmartPreferences(prefs) {
  if (typeof window === 'undefined' || !prefs) return
  window.localStorage.setItem(SMART_PREFS_KEY, JSON.stringify(prefs))
}

/**
 * Clears any stored smart-detection preferences and location cache.
 */
export function clearSmartPreferences() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SMART_PREFS_KEY)
  window.localStorage.removeItem(LOCATION_CACHE_KEY)
}

/**
 * Detects the user's location (country, currency, tax) via the `/api/location`
 * route. Results are cached in localStorage for a day. Pass `{ force: true }`
 * to bypass the cache and re-query the API.
 */
export async function detectLocation({ force = false } = {}) {
  if (typeof window !== 'undefined' && !force) {
    const rawCache = window.localStorage.getItem(LOCATION_CACHE_KEY)
    if (rawCache) {
      try {
        const parsed = JSON.parse(rawCache)
        if (parsed?.timestamp && parsed?.data && Date.now() - parsed.timestamp < ONE_DAY_MS) {
          return parsed.data
        }
      } catch {
        window.localStorage.removeItem(LOCATION_CACHE_KEY)
      }
    }
  }

  const response = await fetch('/api/location')
  if (!response.ok) {
    throw new Error(`Failed to detect location (${response.status})`)
  }
  const data = await response.json()
  if (!data || data.detected === false) {
    throw new Error(data?.error || 'Location could not be detected')
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      LOCATION_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    )
  }

  return data
}
