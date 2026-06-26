/**
 * Dashboard AI insights engine.
 *
 * Pure, framework-agnostic statistical helpers that power the dashboard's
 * "AI-powered insights" (revenue forecasting, anomaly detection and smart
 * recommendations). Keeping the math here — free of React, Supabase and i18n —
 * makes it deterministic and unit-testable, and lets the UI layer stay a thin
 * presentation shell.
 *
 * The forecast uses ordinary least-squares linear regression; anomaly detection
 * uses a z-score (standard-score) test; recommendations are rule-based and emit
 * i18n message keys + params so the component can localise them.
 */

export type Trend = 'up' | 'down' | 'flat'

export interface ForecastResult {
  /** Projected value for the next period. Clamped to >= 0 unless `allowNegative`. */
  forecast: number
  /** Regression slope (change per period). */
  slope: number
  /** Regression intercept (value at period 0). */
  intercept: number
  /** Overall direction of the fitted line. */
  trend: Trend
  /** Goodness of fit (R², 0..1). 0 when it cannot be computed. */
  confidence: number
  /** Percentage change of the forecast vs. the last observed value. */
  changePct: number
  /** False when there is not enough signal to forecast. */
  sufficient: boolean
}

export interface LabeledValue {
  label: string
  value: number
}

export interface AnomalyPoint {
  index: number
  label: string
  value: number
  /** Signed standard score relative to the series mean. */
  zScore: number
  /** Whether the point is unusually high (`spike`) or low (`drop`). */
  direction: 'spike' | 'drop'
}

export type RecommendationSeverity = 'critical' | 'warning' | 'info' | 'success'

export interface Recommendation {
  id: string
  severity: RecommendationSeverity
  /** Key under `dashboard.ai.recommendations` used to render the message. */
  messageKey: string
  /** ICU params for the message template. */
  params?: Record<string, string | number>
  /** Optional deep-link for the suggested action. */
  href?: string
  /** Optional key under `dashboard.ai.recommendations.actions` for the CTA label. */
  actionKey?: string
}

export interface RecommendationInput {
  overdueAmount: number
  overdueCount: number
  pendingAmount: number
  pendingCount: number
  totalClients: number
  totalInvoices: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  /** Month-over-month revenue change, in percent. */
  revenueChange: number
  forecast?: ForecastResult
}

const TREND_EPSILON = 1e-9

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Mean of a numeric array. Returns 0 for an empty array. */
export function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Population standard deviation. Returns 0 for fewer than 2 values. */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Fits a least-squares line to `series` (indexed 0..n-1) and projects the next
 * value. Robust to empty / single-point / flat / non-finite input.
 */
export function forecastSeries(
  series: number[],
  options: { allowNegative?: boolean; periodsAhead?: number } = {},
): ForecastResult {
  const { allowNegative = false, periodsAhead = 1 } = options
  const clean = (series || []).filter(isFiniteNumber)

  const empty: ForecastResult = {
    forecast: 0,
    slope: 0,
    intercept: 0,
    trend: 'flat',
    confidence: 0,
    changePct: 0,
    sufficient: false,
  }

  if (clean.length === 0) return empty
  if (clean.length === 1) {
    const only = clean[0]
    return { ...empty, forecast: allowNegative ? only : Math.max(0, only), intercept: only }
  }

  const n = clean.length
  const xs = clean.map((_, i) => i)
  const meanX = mean(xs)
  const meanY = mean(clean)

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - meanX) * (clean[i] - meanY)
    denominator += (xs[i] - meanX) ** 2
  }

  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = meanY - slope * meanX

  // Coefficient of determination (R²) as a confidence proxy.
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i]
    ssTot += (clean[i] - meanY) ** 2
    ssRes += (clean[i] - predicted) ** 2
  }
  const confidence = ssTot <= TREND_EPSILON ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot))

  const rawForecast = intercept + slope * (n - 1 + periodsAhead)
  const forecast = allowNegative ? rawForecast : Math.max(0, rawForecast)

  const lastValue = clean[n - 1]
  const changePct = lastValue === 0 ? (forecast > 0 ? 100 : 0) : ((forecast - lastValue) / Math.abs(lastValue)) * 100

  // Trend is judged relative to the average magnitude so tiny absolute slopes on
  // large numbers don't read as a real trend.
  const scale = Math.max(Math.abs(meanY), 1)
  const relativeSlope = slope / scale
  let trend: Trend = 'flat'
  if (relativeSlope > 0.02) trend = 'up'
  else if (relativeSlope < -0.02) trend = 'down'

  return { forecast, slope, intercept, trend, confidence, changePct, sufficient: true }
}

/**
 * Flags points whose value deviates from the series mean by at least
 * `threshold` standard deviations. Returns an empty list when there is too
 * little data or no variance.
 */
export function detectAnomalies(
  series: LabeledValue[],
  options: { threshold?: number; minPoints?: number } = {},
): AnomalyPoint[] {
  const { threshold = 2, minPoints = 4 } = options
  const points = (series || []).filter((p) => p && isFiniteNumber(p.value))
  if (points.length < minPoints) return []

  const values = points.map((p) => p.value)
  const m = mean(values)
  const sd = standardDeviation(values)
  if (sd <= TREND_EPSILON) return []

  const anomalies: AnomalyPoint[] = []
  points.forEach((point, index) => {
    const zScore = (point.value - m) / sd
    if (Math.abs(zScore) >= threshold) {
      anomalies.push({
        index,
        label: point.label,
        value: point.value,
        zScore,
        direction: zScore >= 0 ? 'spike' : 'drop',
      })
    }
  })

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
}

/**
 * Produces an ordered list of rule-based recommendations from the dashboard
 * stats. Most urgent items come first; always returns at least one entry.
 */
export function generateRecommendations(
  input: RecommendationInput,
  options: { limit?: number } = {},
): Recommendation[] {
  const { limit = 4 } = options
  const recs: Recommendation[] = []

  if (input.overdueCount > 0) {
    recs.push({
      id: 'overdue',
      severity: 'critical',
      messageKey: 'overdue',
      params: { count: input.overdueCount, amount: Math.round(input.overdueAmount) },
      href: '/dashboard/invoices?status=overdue',
      actionKey: 'review',
    })
  }

  if (input.pendingCount > 0 && input.pendingAmount > 0) {
    recs.push({
      id: 'pending',
      severity: 'warning',
      messageKey: 'pending',
      params: { count: input.pendingCount, amount: Math.round(input.pendingAmount) },
      href: '/dashboard/invoices?status=pending',
      actionKey: 'remind',
    })
  }

  if (input.totalRevenue > 0 && input.totalExpenses > input.totalRevenue) {
    recs.push({
      id: 'expensesHigh',
      severity: 'warning',
      messageKey: 'expensesHigh',
      href: '/dashboard/expenses',
      actionKey: 'review',
    })
  }

  if (input.revenueChange <= -10) {
    recs.push({
      id: 'revenueDown',
      severity: 'warning',
      messageKey: 'revenueDown',
      params: { pct: Math.abs(Math.round(input.revenueChange)) },
      href: '/dashboard/reports',
      actionKey: 'analyze',
    })
  } else if (input.revenueChange >= 10) {
    recs.push({
      id: 'revenueUp',
      severity: 'success',
      messageKey: 'revenueUp',
      params: { pct: Math.round(input.revenueChange) },
    })
  }

  if (input.forecast?.sufficient && input.forecast.trend === 'up' && input.forecast.forecast > 0) {
    recs.push({
      id: 'forecastUp',
      severity: 'info',
      messageKey: 'forecastUp',
      params: { amount: Math.round(input.forecast.forecast) },
    })
  }

  if (input.totalInvoices === 0) {
    recs.push({
      id: 'createInvoice',
      severity: 'info',
      messageKey: 'createInvoice',
      href: '/dashboard/invoices/new',
      actionKey: 'create',
    })
  } else if (input.totalClients === 0) {
    recs.push({
      id: 'addClient',
      severity: 'info',
      messageKey: 'addClient',
      href: '/dashboard/clients/new',
      actionKey: 'create',
    })
  }

  if (recs.length === 0) {
    recs.push({ id: 'allCaught', severity: 'success', messageKey: 'allCaught' })
  }

  const severityRank: Record<RecommendationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  }
  return recs.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).slice(0, limit)
}
