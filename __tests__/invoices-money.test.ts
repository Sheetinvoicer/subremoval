import { computeInvoiceMoney, normalizeDiscount, round2 } from '@/lib/invoices/money'

describe('round2', () => {
  it('rounds to 2 decimals and coerces non-finite input to 0', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(10.005)).toBe(10.01)
    expect(round2(Number.NaN)).toBe(0)
    expect(round2(Infinity)).toBe(0)
  })
})

describe('normalizeDiscount', () => {
  it('defaults to a zero percentage for nullish/unknown input', () => {
    expect(normalizeDiscount(null)).toEqual({ type: 'percent', value: 0 })
    expect(normalizeDiscount(undefined)).toEqual({ type: 'percent', value: 0 })
  })

  it('clamps percentages to [0, 100] and floors negatives to 0', () => {
    expect(normalizeDiscount({ type: 'percent', value: 150 })).toEqual({ type: 'percent', value: 100 })
    expect(normalizeDiscount({ type: 'percent', value: -5 })).toEqual({ type: 'percent', value: 0 })
  })

  it('keeps fixed amounts non-negative and parses numeric strings', () => {
    expect(normalizeDiscount({ type: 'fixed', value: -5 })).toEqual({ type: 'fixed', value: 0 })
    expect(normalizeDiscount({ type: 'fixed', value: '25' })).toEqual({ type: 'fixed', value: 25 })
  })
})

// Asserts the core invariants for any computed result so every scenario below
// is also checked for internal consistency.
function expectReconciles(result: ReturnType<typeof computeInvoiceMoney>) {
  const lineTax = round2(result.lines.reduce((sum, l) => sum + l.tax, 0))
  const lineDiscount = round2(result.lines.reduce((sum, l) => sum + l.discount, 0))
  expect(lineTax).toBe(result.taxAmount)
  expect(lineDiscount).toBe(result.discountAmount)
  expect(result.discountAmount).toBeLessThanOrEqual(result.subtotal)
  expect(
    round2(result.subtotal - result.discountAmount + result.taxAmount + result.roundingAdjustment),
  ).toBe(result.total)
}

describe('computeInvoiceMoney — exclusive tax', () => {
  it('computes a single-rate invoice with the invoice-level fallback rate', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: 2, price: 50, taxRate: null }],
      invoiceTaxRate: 20,
      taxMode: 'exclusive',
    })
    expect(result.subtotal).toBe(100)
    expect(result.discountAmount).toBe(0)
    expect(result.taxAmount).toBe(20)
    expect(result.total).toBe(120)
    expect(result.effectiveTaxRate).toBe(20)
    expectReconciles(result)
  })

  it('supports per-line (multi-rate) tax and blends the effective rate', () => {
    const result = computeInvoiceMoney({
      items: [
        { quantity: 1, price: 100, taxRate: 20 },
        { quantity: 1, price: 100, taxRate: 10 },
      ],
      invoiceTaxRate: 0,
      taxMode: 'exclusive',
    })
    expect(result.subtotal).toBe(200)
    expect(result.taxAmount).toBe(30)
    expect(result.total).toBe(230)
    expect(result.effectiveTaxRate).toBe(15)
    expect(result.lines.map((l) => l.tax)).toEqual([20, 10])
    expectReconciles(result)
  })

  it('applies a percentage discount on the subtotal before tax', () => {
    const result = computeInvoiceMoney({
      items: [
        { quantity: 1, price: 100, taxRate: 20 },
        { quantity: 1, price: 100, taxRate: 20 },
      ],
      invoiceTaxRate: 20,
      taxMode: 'exclusive',
      discount: { type: 'percent', value: 10 },
    })
    expect(result.subtotal).toBe(200)
    expect(result.discountAmount).toBe(20)
    expect(result.taxAmount).toBe(36) // 18 + 18 on the discounted 90/90 base
    expect(result.total).toBe(216)
    expect(result.effectiveTaxRate).toBe(20)
    expectReconciles(result)
  })

  it('clamps a fixed discount larger than the subtotal to the subtotal', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: 1, price: 50, taxRate: 10 }],
      taxMode: 'exclusive',
      discount: { type: 'fixed', value: 100 },
    })
    expect(result.subtotal).toBe(50)
    expect(result.discountAmount).toBe(50)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(0)
    expect(result.effectiveTaxRate).toBe(0)
    expectReconciles(result)
  })

  it('allocates an indivisible discount with largest-remainder so lines sum exactly', () => {
    const result = computeInvoiceMoney({
      items: [
        { quantity: 1, price: 100, taxRate: 0 },
        { quantity: 1, price: 50, taxRate: 0 },
        { quantity: 1, price: 33, taxRate: 0 },
      ],
      taxMode: 'exclusive',
      discount: { type: 'fixed', value: 10 },
    })
    expect(result.subtotal).toBe(183)
    expect(result.discountAmount).toBe(10)
    expect(result.lines.map((l) => l.discount)).toEqual([5.47, 2.73, 1.8])
    expect(result.total).toBe(173)
    expectReconciles(result)
  })
})

describe('computeInvoiceMoney — inclusive tax', () => {
  it('backs the tax out of tax-inclusive line prices', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: 1, price: 120, taxRate: 20 }],
      taxMode: 'inclusive',
      invoiceTaxRate: 20,
    })
    expect(result.subtotal).toBe(100)
    expect(result.taxAmount).toBe(20)
    expect(result.total).toBe(120) // inclusive price is preserved as the total
    expect(result.effectiveTaxRate).toBe(20)
    expectReconciles(result)
  })

  it('handles a 0% inclusive line (price equals net, no tax)', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: 2, price: 25, taxRate: 0 }],
      taxMode: 'inclusive',
    })
    expect(result.subtotal).toBe(50)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(50)
    expectReconciles(result)
  })
})

describe('computeInvoiceMoney — rounding increment', () => {
  it('rounds the grand total to the nearest increment and reports the delta', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: 1, price: 10.02, taxRate: 7 }],
      taxMode: 'exclusive',
      invoiceTaxRate: 7,
      roundingIncrement: 0.05,
    })
    // subtotal 10.02, tax 0.70 -> preRound 10.72 -> nearest 0.05 = 10.70
    expect(result.subtotal).toBe(10.02)
    expect(result.taxAmount).toBe(0.7)
    expect(result.total).toBe(10.7)
    expect(result.roundingAdjustment).toBe(-0.02)
    expectReconciles(result)
  })

  it('treats a 0 increment as a no-op', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: 1, price: 10.02, taxRate: 7 }],
      taxMode: 'exclusive',
      roundingIncrement: 0,
    })
    expect(result.roundingAdjustment).toBe(0)
    expect(result.total).toBe(10.72)
  })
})

describe('computeInvoiceMoney — edge cases', () => {
  it('returns zeros for an empty item list', () => {
    const result = computeInvoiceMoney({ items: [] })
    expect(result.subtotal).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(0)
    expect(result.effectiveTaxRate).toBe(0)
    expect(result.lines).toEqual([])
  })

  it('coerces invalid quantities/prices/rates to 0', () => {
    const result = computeInvoiceMoney({
      items: [
        { quantity: 'oops' as unknown as number, price: 10, taxRate: 'bad' as unknown as number },
        { quantity: -3, price: 10, taxRate: 10 },
      ],
      invoiceTaxRate: 5,
    })
    // first line: quantity coerces to 0 -> net 0; rate falls back? 'bad' is non-empty
    // so it is treated as own-rate that coerces to the invoice fallback (5).
    // second line: negative quantity clamps to 0 -> net 0.
    expect(result.subtotal).toBe(0)
    expect(result.total).toBe(0)
    expectReconciles(result)
  })

  it('accepts numeric strings for quantity and price', () => {
    const result = computeInvoiceMoney({
      items: [{ quantity: '3', price: '9.99', taxRate: '0' }],
      taxMode: 'exclusive',
    })
    expect(result.subtotal).toBe(29.97)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(29.97)
    expectReconciles(result)
  })
})
