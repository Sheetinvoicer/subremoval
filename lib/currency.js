const ONE_DAY_MS = 24 * 60 * 60 * 1000

export const CURRENCY_META = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  BRL: { symbol: 'R$', name: 'Brazilian Real' },
  MXN: { symbol: '$', name: 'Mexican Peso' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
}

export const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.36,
  AUD: 1.51,
  JPY: 148.5,
  CNY: 7.25,
  INR: 83.5,
  BRL: 5.15,
  MXN: 16.8,
  AED: 3.67,
}

export function getCurrencySymbol(currencyCode = 'USD') {
  return CURRENCY_META[currencyCode]?.symbol || '$'
}

export function convertAmount(amount, fromCurrency = 'USD', toCurrency = 'USD', rates = FALLBACK_RATES) {
  const numericAmount = Number(amount || 0)
  if (fromCurrency === toCurrency) {
    return numericAmount
  }

  const fromRate = Number(rates[fromCurrency])
  const toRate = Number(rates[toCurrency])

  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
    return numericAmount
  }

  const amountInUsd = numericAmount / fromRate
  return amountInUsd * toRate
}

export function formatCurrencyAmount(amount, currencyCode = 'USD', locale = 'en-US') {
  const value = Number(amount || 0)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    const symbol = getCurrencySymbol(currencyCode)
    return `${symbol} ${value.toFixed(2)}`
  }
}

export async function fetchExchangeRates() {
  const response = await fetch('/api/currency/rates')
  if (!response.ok) {
    throw new Error(`Failed to load rates (${response.status})`)
  }
  const data = await response.json()
  if (!data?.rates || typeof data.rates !== 'object') {
    throw new Error('Invalid rates payload')
  }
  return data
}

export async function getRatesWithDailyCache() {
  if (typeof window === 'undefined') {
    const data = await fetchExchangeRates()
    return data.rates
  }

  const cacheKey = 'exchange_rates_cache_v1'
  const rawCache = window.localStorage.getItem(cacheKey)

  if (rawCache) {
    try {
      const parsed = JSON.parse(rawCache)
      if (parsed?.timestamp && parsed?.rates && Date.now() - parsed.timestamp < ONE_DAY_MS) {
        return parsed.rates
      }
    } catch {
      window.localStorage.removeItem(cacheKey)
    }
  }

  const data = await fetchExchangeRates()
  window.localStorage.setItem(
    cacheKey,
    JSON.stringify({
      timestamp: Date.now(),
      rates: data.rates,
    })
  )
  return data.rates
}
