import {
  forecastSeries,
  detectAnomalies,
  generateRecommendations,
  mean,
  standardDeviation,
  type RecommendationInput,
} from '@/lib/dashboard/insights'

describe('dashboard insights — statistics helpers', () => {
  it('computes mean and population standard deviation', () => {
    expect(mean([])).toBe(0)
    expect(mean([2, 4, 6])).toBe(4)
    expect(standardDeviation([5])).toBe(0)
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5)
  })
})

describe('forecastSeries', () => {
  it('returns an insufficient/zero forecast for empty input', () => {
    const result = forecastSeries([])
    expect(result.sufficient).toBe(false)
    expect(result.forecast).toBe(0)
    expect(result.trend).toBe('flat')
    expect(result.confidence).toBe(0)
  })

  it('handles a single data point without crashing', () => {
    const result = forecastSeries([320])
    expect(result.sufficient).toBe(false)
    expect(result.forecast).toBe(320)
  })

  it('projects a clean upward linear trend with high confidence', () => {
    const result = forecastSeries([100, 200, 300, 400])
    expect(result.sufficient).toBe(true)
    expect(result.slope).toBeCloseTo(100, 5)
    expect(result.intercept).toBeCloseTo(100, 5)
    expect(result.forecast).toBeCloseTo(500, 5)
    expect(result.trend).toBe('up')
    expect(result.confidence).toBeCloseTo(1, 5)
    expect(result.changePct).toBeCloseTo(25, 5)
  })

  it('detects a downward trend and clamps revenue forecasts to zero', () => {
    const result = forecastSeries([400, 250, 120, 30])
    expect(result.trend).toBe('down')
    expect(result.forecast).toBeGreaterThanOrEqual(0)
  })

  it('allows negative forecasts when explicitly requested (e.g. net profit)', () => {
    const result = forecastSeries([100, 0, -100, -200], { allowNegative: true })
    expect(result.trend).toBe('down')
    expect(result.forecast).toBeLessThan(0)
  })

  it('treats a flat series as no trend with zero confidence', () => {
    const result = forecastSeries([50, 50, 50, 50])
    expect(result.slope).toBeCloseTo(0, 5)
    expect(result.trend).toBe('flat')
    expect(result.confidence).toBe(0)
    expect(result.forecast).toBeCloseTo(50, 5)
  })

  it('ignores non-finite values', () => {
    const result = forecastSeries([100, Number.NaN, 300])
    expect(result.sufficient).toBe(true)
    expect(result.forecast).toBeCloseTo(500, 5)
  })
})

describe('detectAnomalies', () => {
  it('returns nothing when there are too few points', () => {
    expect(detectAnomalies([{ label: 'a', value: 10 }, { label: 'b', value: 100 }])).toEqual([])
  })

  it('returns nothing when the series has no variance', () => {
    const flat = [50, 50, 50, 50].map((value, i) => ({ label: `m${i}`, value }))
    expect(detectAnomalies(flat)).toEqual([])
  })

  it('flags an unusual spike', () => {
    const series = [10, 10, 10, 10, 100].map((value, i) => ({ label: `m${i}`, value }))
    const anomalies = detectAnomalies(series)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].direction).toBe('spike')
    expect(anomalies[0].label).toBe('m4')
    expect(anomalies[0].zScore).toBeGreaterThanOrEqual(2)
  })

  it('flags an unusual drop', () => {
    const series = [100, 100, 100, 100, 10].map((value, i) => ({ label: `m${i}`, value }))
    const anomalies = detectAnomalies(series)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].direction).toBe('drop')
  })
})

describe('generateRecommendations', () => {
  const base: RecommendationInput = {
    overdueAmount: 0,
    overdueCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    totalClients: 5,
    totalInvoices: 10,
    totalRevenue: 1000,
    totalExpenses: 100,
    netProfit: 900,
    revenueChange: 0,
  }

  it('prioritises overdue invoices as a critical action', () => {
    const recs = generateRecommendations({ ...base, overdueCount: 3, overdueAmount: 1200 })
    expect(recs[0].severity).toBe('critical')
    expect(recs[0].messageKey).toBe('overdue')
    expect(recs[0].params).toEqual({ count: 3, amount: 1200 })
  })

  it('always returns a positive "all caught up" message when nothing is wrong', () => {
    const recs = generateRecommendations(base)
    expect(recs).toHaveLength(1)
    expect(recs[0].messageKey).toBe('allCaught')
    expect(recs[0].severity).toBe('success')
  })

  it('celebrates strong revenue growth', () => {
    const recs = generateRecommendations({ ...base, revenueChange: 25 })
    expect(recs.some((r) => r.messageKey === 'revenueUp')).toBe(true)
  })

  it('orders by severity and respects the limit', () => {
    const recs = generateRecommendations(
      {
        ...base,
        overdueCount: 2,
        overdueAmount: 800,
        pendingCount: 4,
        pendingAmount: 600,
        revenueChange: -20,
        totalRevenue: 100,
        totalExpenses: 500,
      },
      { limit: 2 },
    )
    expect(recs).toHaveLength(2)
    expect(recs[0].severity).toBe('critical')
    expect(recs[1].severity).toBe('warning')
  })
})
