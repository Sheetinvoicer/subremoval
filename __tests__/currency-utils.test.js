import {
  convertAmount,
  formatCurrencyAmount,
  getCurrencySymbol,
  getRatesWithDailyCache,
} from '@/lib/currency'

describe('currency utils', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('converts between currencies using USD base rates', () => {
    const rates = { USD: 1, EUR: 0.5, GBP: 0.25 }
    expect(convertAmount(100, 'USD', 'EUR', rates)).toBe(50)
    expect(convertAmount(100, 'EUR', 'GBP', rates)).toBe(50)
  })

  it('returns correct symbols with fallback', () => {
    expect(getCurrencySymbol('USD')).toBe('$')
    expect(getCurrencySymbol('EUR')).toBe('€')
    expect(getCurrencySymbol('UNKNOWN')).toBe('$')
  })

  it('formats values as currency strings', () => {
    const formatted = formatCurrencyAmount(1234.5, 'USD')
    expect(formatted).toContain('$')
    expect(formatted).toContain('1,234.50')
  })

  it('fetches rates and caches them daily in localStorage', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: 1, EUR: 0.9 } }),
    })

    const first = await getRatesWithDailyCache()
    const second = await getRatesWithDailyCache()

    expect(first).toEqual({ USD: 1, EUR: 0.9 })
    expect(second).toEqual({ USD: 1, EUR: 0.9 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
