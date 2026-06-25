import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectLocation,
  loadSmartPreferences,
  saveSmartPreferences,
} from '@/lib/location'
import { getRatesWithDailyCache } from '@/lib/currency'

export interface DetectedLocation {
  countryCode: string
  countryName: string | null
  region: string | null
  city: string | null
  currency: string
  tax: { type: string; rate: number; name: string }
  source?: string
}

export interface SmartPreferences {
  currency: string
  taxRate: number
  taxType: string
  taxName: string
  country: string
  autoDetect: boolean
  manualOverride: boolean
  updatedAt: number
}

interface UseSmartDetectionOptions {
  /** Initial currency (e.g. from saved server settings). */
  initialCurrency?: string
  /** Initial tax rate percentage. */
  initialTaxRate?: number
  /** When false, the hook stays idle and performs no detection. */
  enabled?: boolean
  /** Persist preference changes to localStorage. Defaults to true. */
  persist?: boolean
}

/**
 * Orchestrates smart currency & tax detection:
 *  - restores remembered preferences from localStorage,
 *  - auto-detects the user's country/currency/tax from their IP (ipapi.co),
 *  - loads real-time exchange rates,
 *  - and lets the user override any value, which is then remembered.
 */
export function useSmartDetection(options: UseSmartDetectionOptions = {}) {
  const {
    initialCurrency = 'USD',
    initialTaxRate = 0,
    enabled = true,
    persist = true,
  } = options

  const [currency, setCurrencyState] = useState(initialCurrency)
  const [taxRate, setTaxRateState] = useState(initialTaxRate)
  const [taxType, setTaxType] = useState('Tax')
  const [taxName, setTaxName] = useState('')
  const [country, setCountry] = useState('')
  const [autoDetect, setAutoDetectState] = useState(true)
  const [manualOverride, setManualOverride] = useState(false)

  const [detected, setDetected] = useState<DetectedLocation | null>(null)
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guards localStorage writes until after the initial restore/detect so we
  // never persist transient default state on top of saved preferences.
  const readyRef = useRef(false)

  const persistPrefs = useCallback(
    (next: Partial<SmartPreferences>) => {
      if (!persist || !readyRef.current) return
      const prefs: SmartPreferences = {
        currency,
        taxRate,
        taxType,
        taxName,
        country,
        autoDetect,
        manualOverride,
        updatedAt: Date.now(),
        ...next,
      }
      saveSmartPreferences(prefs)
    },
    [persist, currency, taxRate, taxType, taxName, country, autoDetect, manualOverride],
  )

  const applyDetection = useCallback(
    (location: DetectedLocation) => {
      setDetected(location)
      setCountry(location.countryCode)
      setCurrencyState(location.currency)
      setTaxRateState(location.tax.rate)
      setTaxType(location.tax.type)
      setTaxName(location.tax.name)
      persistPrefs({
        currency: location.currency,
        taxRate: location.tax.rate,
        taxType: location.tax.type,
        taxName: location.tax.name,
        country: location.countryCode,
        manualOverride: false,
      })
    },
    [persistPrefs],
  )

  const runDetection = useCallback(async (force = false) => {
    setDetecting(true)
    setError(null)
    try {
      const location = (await detectLocation({ force })) as DetectedLocation
      return location
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location detection failed')
      return null
    } finally {
      setDetecting(false)
    }
  }, [])

  // Initial load: restore preferences, load rates, optionally auto-detect.
  useEffect(() => {
    let cancelled = false

    async function init() {
      const saved = loadSmartPreferences()
      let shouldAutoDetect = enabled
      let alreadyOverridden = false

      if (saved) {
        if (typeof saved.currency === 'string') setCurrencyState(saved.currency)
        if (typeof saved.taxRate === 'number') setTaxRateState(saved.taxRate)
        if (typeof saved.taxType === 'string') setTaxType(saved.taxType)
        if (typeof saved.taxName === 'string') setTaxName(saved.taxName)
        if (typeof saved.country === 'string') setCountry(saved.country)
        if (typeof saved.autoDetect === 'boolean') {
          setAutoDetectState(saved.autoDetect)
          shouldAutoDetect = enabled && saved.autoDetect
        }
        if (typeof saved.manualOverride === 'boolean') {
          setManualOverride(saved.manualOverride)
          alreadyOverridden = saved.manualOverride
        }
      }

      // Load real-time exchange rates (best-effort, non-blocking for UI).
      getRatesWithDailyCache()
        .then((loaded) => {
          if (!cancelled) setRates(loaded)
        })
        .catch(() => {
          if (!cancelled) setRates(null)
        })

      // Auto-detect only when enabled and the user hasn't pinned a manual
      // override yet. Existing overrides are respected and remembered.
      if (shouldAutoDetect && !alreadyOverridden) {
        const location = await runDetection(false)
        if (location && !cancelled) {
          setDetected(location)
          setCountry(location.countryCode)
          setCurrencyState(location.currency)
          setTaxRateState(location.tax.rate)
          setTaxType(location.tax.type)
          setTaxName(location.tax.name)
        }
      }

      if (!cancelled) {
        readyRef.current = true
        setLoading(false)
        // Persist a baseline so preferences exist even before any edit.
        if (persist) {
          persistPrefs({})
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCurrency = useCallback(
    (next: string) => {
      const value = (next || '').toUpperCase()
      setCurrencyState(value)
      setManualOverride(true)
      persistPrefs({ currency: value, manualOverride: true })
    },
    [persistPrefs],
  )

  const setTaxRate = useCallback(
    (next: number) => {
      const value = Number.isFinite(next) ? next : 0
      setTaxRateState(value)
      setManualOverride(true)
      persistPrefs({ taxRate: value, manualOverride: true })
    },
    [persistPrefs],
  )

  const setAutoDetect = useCallback(
    async (value: boolean) => {
      setAutoDetectState(value)
      if (value) {
        // Re-enable detection: clear the manual override and apply fresh data.
        setManualOverride(false)
        persistPrefs({ autoDetect: true, manualOverride: false })
        const location = await runDetection(true)
        if (location) applyDetection(location)
      } else {
        persistPrefs({ autoDetect: false })
      }
    },
    [persistPrefs, runDetection, applyDetection],
  )

  const redetect = useCallback(async () => {
    const location = await runDetection(true)
    if (location) applyDetection(location)
    return location
  }, [runDetection, applyDetection])

  const getPreferences = useCallback(
    (): SmartPreferences => ({
      currency,
      taxRate,
      taxType,
      taxName,
      country,
      autoDetect,
      manualOverride,
      updatedAt: Date.now(),
    }),
    [currency, taxRate, taxType, taxName, country, autoDetect, manualOverride],
  )

  const savePreferences = useCallback(() => {
    const prefs = getPreferences()
    saveSmartPreferences(prefs)
    return prefs
  }, [getPreferences])

  return {
    // values
    currency,
    taxRate,
    taxType,
    taxName,
    country,
    autoDetect,
    manualOverride,
    detected,
    rates,
    // status
    loading,
    detecting,
    error,
    // actions
    setCurrency,
    setTaxRate,
    setAutoDetect,
    redetect,
    getPreferences,
    savePreferences,
  }
}

export default useSmartDetection
