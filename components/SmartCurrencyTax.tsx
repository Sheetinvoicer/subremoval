'use client'

import { useMemo } from 'react'
import { Globe, RefreshCw, Sparkles, MapPin } from 'lucide-react'
import { CURRENCY_META } from '@/lib/currency'
import type { DetectedLocation } from '@/hooks/useSmartDetection'

export interface SmartCurrencyTaxLabels {
  title: string
  subtitle: string
  detecting: string
  detectedIn: string // e.g. "Detected in"
  autoDetect: string
  redetect: string
  currencyLabel: string
  taxLabel: string // generic fallback when no tax type, e.g. "Tax rate (%)"
  overrideHint: string
  detectFailed: string
  ratesLive: string
  ratesFallback: string
}

const DEFAULT_LABELS: SmartCurrencyTaxLabels = {
  title: 'Smart currency & tax',
  subtitle: 'Auto-detected from your location. You can override any value.',
  detecting: 'Detecting your location…',
  detectedIn: 'Detected in',
  autoDetect: 'Auto-detect',
  redetect: 'Re-detect',
  currencyLabel: 'Currency',
  taxLabel: 'Tax rate (%)',
  overrideHint: 'Manual override active — your choice is remembered.',
  detectFailed: "Couldn't detect your location. Using defaults — you can still pick manually.",
  ratesLive: 'Live exchange rates loaded',
  ratesFallback: 'Using fallback exchange rates',
}

interface SmartCurrencyTaxProps {
  currency: string
  taxRate: number
  taxType?: string
  detected?: DetectedLocation | null
  autoDetect: boolean
  manualOverride?: boolean
  detecting?: boolean
  error?: string | null
  rates?: Record<string, number> | null
  onCurrencyChange: (currency: string) => void
  onTaxRateChange: (rate: number) => void
  onAutoDetectChange: (value: boolean) => void
  onRedetect: () => void
  /** Visual theme: 'dark' matches the app dashboard tokens, 'light' the settings pages. */
  variant?: 'dark' | 'light'
  labels?: Partial<SmartCurrencyTaxLabels>
  className?: string
}

/**
 * Presentational smart currency & tax panel. State (detection, preferences,
 * overrides) is owned by the parent via the `useSmartDetection` hook; this
 * component only renders the banner and the override controls.
 */
export default function SmartCurrencyTax({
  currency,
  taxRate,
  taxType,
  detected,
  autoDetect,
  manualOverride = false,
  detecting = false,
  error = null,
  rates = null,
  onCurrencyChange,
  onTaxRateChange,
  onAutoDetectChange,
  onRedetect,
  variant = 'dark',
  labels,
  className = '',
}: SmartCurrencyTaxProps) {
  const l = { ...DEFAULT_LABELS, ...(labels || {}) }
  const isDark = variant === 'dark'

  // Build the currency option list from known currencies plus whatever is
  // currently selected/detected so overrides never lose the active value.
  const currencyOptions = useMemo(() => {
    const codes = new Set<string>(Object.keys(CURRENCY_META))
    if (currency) codes.add(currency.toUpperCase())
    if (detected?.currency) codes.add(detected.currency.toUpperCase())
    return Array.from(codes).sort()
  }, [currency, detected])

  const taxFieldLabel = taxType && taxType !== 'Tax' ? `${taxType} (%)` : l.taxLabel

  const containerClass = isDark
    ? 'rounded-card border border-accent/30 bg-accent/5 p-4'
    : 'rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4'

  const inputClass = isDark
    ? 'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
    : 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm'

  const labelClass = isDark
    ? 'block text-sm font-medium mb-1 text-text-secondary'
    : 'block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300'

  const titleClass = isDark ? 'text-text-primary' : 'text-gray-900 dark:text-white'
  const subtitleClass = isDark ? 'text-text-secondary' : 'text-gray-500 dark:text-gray-400'
  const chipClass = isDark
    ? 'inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent'
    : 'inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300'
  const accentText = isDark ? 'text-accent' : 'text-blue-600 dark:text-blue-400'

  return (
    <div className={`${containerClass} ${className}`.trim()} data-testid="smart-currency-tax">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className={accentText}>
            <Sparkles size={18} />
          </span>
          <div>
            <h3 className={`font-semibold ${titleClass}`}>{l.title}</h3>
            <p className={`text-xs ${subtitleClass}`}>{l.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 text-sm ${subtitleClass}`}>
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => onAutoDetectChange(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
              aria-label={l.autoDetect}
            />
            {l.autoDetect}
          </label>
          <button
            type="button"
            onClick={onRedetect}
            disabled={detecting}
            className={`inline-flex items-center gap-1 text-sm ${accentText} hover:underline disabled:opacity-50`}
          >
            <RefreshCw size={14} className={detecting ? 'animate-spin' : ''} />
            {l.redetect}
          </button>
        </div>
      </div>

      {/* Detection status */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {detecting ? (
          <span className={`inline-flex items-center gap-1 ${subtitleClass}`}>
            <Globe size={14} className="animate-pulse" />
            {l.detecting}
          </span>
        ) : detected ? (
          <>
            <span className={`inline-flex items-center gap-1 ${titleClass}`}>
              <MapPin size={14} className={accentText} />
              {l.detectedIn}{' '}
              {[detected.city, detected.countryName || detected.countryCode]
                .filter(Boolean)
                .join(', ')}
            </span>
            <span className={chipClass}>{detected.currency}</span>
            {detected.tax && (
              <span className={chipClass}>
                {detected.tax.type} {detected.tax.rate}%
              </span>
            )}
          </>
        ) : error ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">{l.detectFailed}</span>
        ) : null}
      </div>

      {/* Override controls */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="smart-currency" className={labelClass}>
            {l.currencyLabel}
          </label>
          <select
            id="smart-currency"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className={inputClass}
          >
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code}
                {CURRENCY_META[code]?.name ? ` — ${CURRENCY_META[code].name}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="smart-tax-rate" className={labelClass}>
            {taxFieldLabel}
          </label>
          <input
            id="smart-tax-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => onTaxRateChange(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {manualOverride ? (
          <span className={`text-xs ${accentText}`}>{l.overrideHint}</span>
        ) : (
          <span />
        )}
        <span className={`text-xs ${subtitleClass}`}>
          {rates ? l.ratesLive : l.ratesFallback}
        </span>
      </div>
    </div>
  )
}
