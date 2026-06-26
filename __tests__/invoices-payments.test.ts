import {
  INVOICE_STATUS_LIFECYCLE,
  PAYMENT_KINDS,
  computeBalance,
  isInvoiceStatus,
  isPaymentKind,
  roundMoney,
} from '@/lib/invoices/payments'

describe('invoice payments balance math', () => {
  it('returns the full total owed when there are no payments', () => {
    expect(computeBalance(250, [])).toEqual({ paid: 0, balance: 250, fullyPaid: false })
  })

  it('reduces the balance by a partial payment without marking it paid', () => {
    expect(computeBalance(100, [{ amount: 40 }])).toEqual({ paid: 40, balance: 60, fullyPaid: false })
  })

  it('marks the invoice fully paid once a single payment covers the total', () => {
    expect(computeBalance(100, [{ amount: 100 }])).toEqual({ paid: 100, balance: 0, fullyPaid: true })
  })

  it('sums multiple entries across every kind (payment, credit, adjustment)', () => {
    const balance = computeBalance(100, [{ amount: 30 }, { amount: 20 }, { amount: 25 }])
    expect(balance).toEqual({ paid: 75, balance: 25, fullyPaid: false })
  })

  it('rounds the running total to 2 decimals so fractional payments settle exactly', () => {
    // 33.33 + 33.33 + 33.34 = 100.00 exactly after rounding.
    const balance = computeBalance(100, [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }])
    expect(balance.paid).toBe(100)
    expect(balance.balance).toBe(0)
    expect(balance.fullyPaid).toBe(true)
  })

  it('treats an overpayment as fully paid with a negative (credit) balance', () => {
    expect(computeBalance(100, [{ amount: 120 }])).toEqual({ paid: 120, balance: -20, fullyPaid: true })
  })

  it('settles within half a cent to absorb floating-point drift', () => {
    const balance = computeBalance(100, [{ amount: 99.999 }])
    expect(balance.fullyPaid).toBe(true)
    expect(balance.balance).toBe(0)
  })

  it('coerces string / null / undefined amounts safely', () => {
    const balance = computeBalance(100, [
      { amount: '40' as unknown as number },
      { amount: null },
      { amount: undefined },
    ])
    expect(balance).toEqual({ paid: 40, balance: 60, fullyPaid: false })
  })

  it('never returns a confusing -0 balance once settled', () => {
    const balance = computeBalance(0, [])
    expect(Object.is(balance.balance, -0)).toBe(false)
    expect(balance).toEqual({ paid: 0, balance: 0, fullyPaid: true })
  })
})

describe('roundMoney', () => {
  it('rounds to 2 decimals and guards non-finite input', () => {
    expect(roundMoney(2.49975)).toBe(2.5)
    expect(roundMoney(10.126)).toBe(10.13)
    expect(roundMoney(10.124)).toBe(10.12)
    expect(roundMoney(Number.NaN)).toBe(0)
    expect(roundMoney(Infinity)).toBe(0)
  })
})

describe('lifecycle + kind guards', () => {
  it('exposes the full seven-state lifecycle', () => {
    expect(INVOICE_STATUS_LIFECYCLE).toEqual([
      'draft',
      'sent',
      'viewed',
      'paid',
      'overdue',
      'disputed',
      'cancelled',
    ])
  })

  it('validates statuses', () => {
    expect(isInvoiceStatus('disputed')).toBe(true)
    expect(isInvoiceStatus('archived')).toBe(false)
    expect(isInvoiceStatus(42)).toBe(false)
  })

  it('validates payment kinds', () => {
    expect(PAYMENT_KINDS).toEqual(['payment', 'credit', 'adjustment'])
    expect(isPaymentKind('credit')).toBe(true)
    expect(isPaymentKind('refund')).toBe(false)
  })
})
