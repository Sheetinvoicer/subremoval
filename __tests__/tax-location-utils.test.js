import {
  TAX_RATES,
  DEFAULT_TAX,
  getTaxInfo,
  getTaxRate,
  getTaxLabel,
  hasTaxInfo,
} from '@/lib/tax'
import {
  COUNTRY_CURRENCY,
  getCurrencyForCountry,
  loadSmartPreferences,
  saveSmartPreferences,
  clearSmartPreferences,
  detectLocation,
  LOCATION_CACHE_KEY,
  SMART_PREFS_KEY,
} from '@/lib/location'

describe('tax database', () => {
  it('returns the correct tax regime for known countries', () => {
    expect(getTaxInfo('GB')).toEqual(TAX_RATES.GB)
    expect(getTaxRate('GB')).toBe(20)
    expect(getTaxLabel('GB')).toBe('VAT')

    expect(getTaxLabel('AU')).toBe('GST')
    expect(getTaxRate('AU')).toBe(10)

    expect(getTaxLabel('JP')).toBe('Consumption Tax')
    expect(getTaxLabel('US')).toBe('Sales Tax')
  })

  it('is case-insensitive and trims input', () => {
    expect(getTaxRate('de')).toBe(19)
    expect(getTaxRate('  fr ')).toBe(20)
  })

  it('falls back to a zero-rated generic tax for unknown countries', () => {
    expect(getTaxInfo('ZZ')).toEqual(DEFAULT_TAX)
    expect(getTaxRate('ZZ')).toBe(0)
    expect(getTaxRate('')).toBe(0)
    expect(getTaxRate(undefined)).toBe(0)
  })

  it('reports whether explicit tax info exists', () => {
    expect(hasTaxInfo('GB')).toBe(true)
    expect(hasTaxInfo('ZZ')).toBe(false)
    expect(hasTaxInfo('')).toBe(false)
  })
})

describe('country -> currency mapping', () => {
  it('maps countries to their national currency', () => {
    expect(getCurrencyForCountry('US')).toBe('USD')
    expect(getCurrencyForCountry('GB')).toBe('GBP')
    expect(getCurrencyForCountry('DE')).toBe('EUR')
    expect(getCurrencyForCountry('FR')).toBe(COUNTRY_CURRENCY.FR)
    expect(getCurrencyForCountry('AE')).toBe('AED')
  })

  it('is case-insensitive and defaults to USD', () => {
    expect(getCurrencyForCountry('jp')).toBe('JPY')
    expect(getCurrencyForCountry('ZZ')).toBe('USD')
    expect(getCurrencyForCountry('')).toBe('USD')
    expect(getCurrencyForCountry(null)).toBe('USD')
  })
})

describe('smart preference persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips preferences through localStorage', () => {
    expect(loadSmartPreferences()).toBeNull()

    const prefs = {
      currency: 'EUR',
      taxRate: 19,
      taxType: 'VAT',
      country: 'DE',
      autoDetect: true,
      manualOverride: false,
      updatedAt: 123,
    }
    saveSmartPreferences(prefs)

    expect(JSON.parse(localStorage.getItem(SMART_PREFS_KEY))).toEqual(prefs)
    expect(loadSmartPreferences()).toEqual(prefs)
  })

  it('returns null and clears corrupt preference data', () => {
    localStorage.setItem(SMART_PREFS_KEY, '{not-json')
    expect(loadSmartPreferences()).toBeNull()
    expect(localStorage.getItem(SMART_PREFS_KEY)).toBeNull()
  })

  it('clears stored preferences and the location cache', () => {
    saveSmartPreferences({ currency: 'EUR' })
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: {} }))

    clearSmartPreferences()

    expect(localStorage.getItem(SMART_PREFS_KEY)).toBeNull()
    expect(localStorage.getItem(LOCATION_CACHE_KEY)).toBeNull()
  })
})

describe('detectLocation', () => {
  const sample = {
    detected: true,
    countryCode: 'DE',
    countryName: 'Germany',
    city: 'Berlin',
    currency: 'EUR',
    tax: { type: 'VAT', rate: 19, name: 'Mehrwertsteuer' },
  }

  beforeEach(() => {
    localStorage.clear()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('fetches location and caches it for the day', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => sample })

    const first = await detectLocation()
    const second = await detectLocation()

    expect(first).toEqual(sample)
    expect(second).toEqual(sample)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/location')
  })

  it('bypasses the cache when forced', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => sample })

    await detectLocation()
    await detectLocation({ force: true })

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws when the provider reports a failure', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ detected: false, error: 'RateLimited' }),
    })

    await expect(detectLocation()).rejects.toThrow('RateLimited')
  })

  it('throws on a non-OK response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    await expect(detectLocation()).rejects.toThrow('Failed to detect location (500)')
  })
})
