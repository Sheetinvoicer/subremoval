const {
  amountsMatch,
  markMatched,
  autoReconcile,
} = require('@/lib/bank/reconcile')
const {
  toMajorUnits,
  mapBalanceTransaction,
  syncTransactions,
} = require('@/lib/bank/sync')

/**
 * Minimal chainable Supabase mock. Each `from(table)` returns a fresh builder
 * whose terminal `await` resolves based on the operation:
 *   - select chains  -> selectResults[table]
 *   - update chains  -> updateResult
 *   - upsert chains  -> upsertResult
 */
function makeSupabase({
  selectResults = {},
  updateResult = { error: null },
  upsertResult = { error: null },
  capture = {},
} = {}) {
  function from(table) {
    let mode = 'select'
    const builder = {
      select: () => builder,
      update: (payload) => {
        mode = 'update'
        capture.update && capture.update(table, payload)
        return builder
      },
      upsert: (rows, opts) => {
        mode = 'upsert'
        capture.upsert && capture.upsert(table, rows, opts)
        return builder
      },
      eq: () => builder,
      neq: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => builder,
      then: (resolve) => {
        if (mode === 'update') return resolve(updateResult)
        if (mode === 'upsert') return resolve(upsertResult)
        return resolve(selectResults[table] || { data: [], error: null })
      },
    }
    return builder
  }
  return { from }
}

describe('lib/bank/reconcile', () => {
  describe('amountsMatch', () => {
    it('treats amounts equal to the cent as a match', () => {
      expect(amountsMatch(100, 100)).toBe(true)
      expect(amountsMatch(100, 100.004)).toBe(true)
      expect(amountsMatch(0, null)).toBe(true)
    })

    it('rejects amounts that differ by a cent or more', () => {
      expect(amountsMatch(100, 100.01)).toBe(false)
      expect(amountsMatch(100, 99.99)).toBe(false)
    })
  })

  describe('markMatched', () => {
    it('marks the transaction reconciled and the invoice paid, scoped to the user', async () => {
      const updates = []
      const supabase = makeSupabase({ capture: { update: (t, p) => updates.push([t, p]) } })

      await markMatched(supabase, 'user-1', 'tx-1', 'inv-1')

      expect(updates).toEqual([
        ['transactions', { matched_invoice_id: 'inv-1', reconciled: true }],
        ['invoices', { status: 'paid' }],
      ])
    })

    it('throws when the transaction update fails', async () => {
      const supabase = makeSupabase({ updateResult: { error: { message: 'tx boom' } } })
      await expect(markMatched(supabase, 'u', 't', 'i')).rejects.toThrow('tx boom')
    })
  })

  describe('autoReconcile', () => {
    it('matches incoming payments to equal-total invoices and marks them paid', async () => {
      const updates = []
      const supabase = makeSupabase({
        selectResults: {
          transactions: {
            data: [
              { id: 'tx-1', amount: 100, reconciled: false, matched_invoice_id: null },
              { id: 'tx-2', amount: 250, reconciled: false, matched_invoice_id: null },
            ],
            error: null,
          },
          invoices: {
            data: [
              { id: 'inv-1', total: 100, status: 'sent' },
              { id: 'inv-2', total: 250, status: 'sent' },
            ],
            error: null,
          },
        },
        capture: { update: (t, p) => updates.push([t, p]) },
      })

      const result = await autoReconcile({ supabase, userId: 'user-1' })

      expect(result.matched).toBe(2)
      expect(result.matches).toEqual([
        { transactionId: 'tx-1', invoiceId: 'inv-1' },
        { transactionId: 'tx-2', invoiceId: 'inv-2' },
      ])
      // Two transaction updates + two invoice updates.
      expect(updates).toHaveLength(4)
    })

    it('ignores outgoing (negative) transactions', async () => {
      const supabase = makeSupabase({
        selectResults: {
          transactions: {
            data: [{ id: 'tx-1', amount: -100, reconciled: false, matched_invoice_id: null }],
            error: null,
          },
          invoices: { data: [{ id: 'inv-1', total: 100, status: 'sent' }], error: null },
        },
      })

      const result = await autoReconcile({ supabase, userId: 'user-1' })
      expect(result.matched).toBe(0)
    })

    it('consumes each invoice only once when amounts collide', async () => {
      const supabase = makeSupabase({
        selectResults: {
          transactions: {
            data: [
              { id: 'tx-1', amount: 100, reconciled: false, matched_invoice_id: null },
              { id: 'tx-2', amount: 100, reconciled: false, matched_invoice_id: null },
            ],
            error: null,
          },
          invoices: { data: [{ id: 'inv-1', total: 100, status: 'sent' }], error: null },
        },
      })

      const result = await autoReconcile({ supabase, userId: 'user-1' })
      expect(result.matched).toBe(1)
      expect(result.matches).toEqual([{ transactionId: 'tx-1', invoiceId: 'inv-1' }])
    })

    it('returns zero matches when no invoice total matches', async () => {
      const supabase = makeSupabase({
        selectResults: {
          transactions: {
            data: [{ id: 'tx-1', amount: 100, reconciled: false, matched_invoice_id: null }],
            error: null,
          },
          invoices: { data: [{ id: 'inv-1', total: 999, status: 'sent' }], error: null },
        },
      })

      const result = await autoReconcile({ supabase, userId: 'user-1' })
      expect(result.matched).toBe(0)
    })

    it('throws on missing arguments', async () => {
      await expect(autoReconcile({ userId: 'u' })).rejects.toThrow('Missing Supabase client')
      await expect(autoReconcile({ supabase: makeSupabase() })).rejects.toThrow('Missing userId')
    })
  })
})

describe('lib/bank/sync', () => {
  describe('toMajorUnits', () => {
    it('converts the smallest currency unit to major units', () => {
      expect(toMajorUnits(12345)).toBe(123.45)
      expect(toMajorUnits(0)).toBe(0)
      expect(toMajorUnits(null)).toBe(0)
    })
  })

  describe('mapBalanceTransaction', () => {
    it('maps a Stripe balance transaction without reconciliation fields', () => {
      const row = mapBalanceTransaction('user-1', {
        id: 'txn_1',
        amount: 5000,
        currency: 'USD',
        description: 'Payment',
        type: 'charge',
        status: 'available',
        created: 1700000000,
      })

      expect(row).toMatchObject({
        user_id: 'user-1',
        stripe_transaction_id: 'txn_1',
        amount: 50,
        currency: 'usd',
        description: 'Payment',
        type: 'charge',
        status: 'available',
      })
      // Reconciliation state must never be overwritten by a sync.
      expect(row).not.toHaveProperty('matched_invoice_id')
      expect(row).not.toHaveProperty('reconciled')
    })
  })

  describe('syncTransactions', () => {
    function makeStripe(data) {
      return { balanceTransactions: { list: jest.fn().mockResolvedValue({ data }) } }
    }

    it('upserts mapped rows and returns the synced count', async () => {
      const upserts = []
      const supabase = makeSupabase({ capture: { upsert: (t, rows, opts) => upserts.push({ t, rows, opts }) } })
      const stripe = makeStripe([
        { id: 'txn_1', amount: 1000, currency: 'usd', type: 'charge', status: 'available', created: 1 },
        { id: 'txn_2', amount: 2000, currency: 'usd', type: 'charge', status: 'available', created: 2 },
      ])

      const result = await syncTransactions({ supabase, userId: 'user-1', accountId: 'acct_1', stripe })

      expect(result.synced).toBe(2)
      expect(stripe.balanceTransactions.list).toHaveBeenCalledWith(
        { limit: 100 },
        { stripeAccount: 'acct_1' },
      )
      expect(upserts).toHaveLength(1)
      expect(upserts[0].t).toBe('transactions')
      expect(upserts[0].opts).toEqual({ onConflict: 'user_id,stripe_transaction_id', ignoreDuplicates: false })
    })

    it('does nothing when Stripe returns no transactions', async () => {
      const upserts = []
      const supabase = makeSupabase({ capture: { upsert: (t, rows) => upserts.push(rows) } })
      const stripe = makeStripe([])

      const result = await syncTransactions({ supabase, userId: 'user-1', accountId: 'acct_1', stripe })

      expect(result).toEqual({ synced: 0, transactions: [] })
      expect(upserts).toHaveLength(0)
    })

    it('throws when the upsert fails', async () => {
      const supabase = makeSupabase({ upsertResult: { error: { message: 'db down' } } })
      const stripe = makeStripe([
        { id: 'txn_1', amount: 1000, currency: 'usd', type: 'charge', status: 'available', created: 1 },
      ])

      await expect(
        syncTransactions({ supabase, userId: 'user-1', accountId: 'acct_1', stripe }),
      ).rejects.toThrow('db down')
    })

    it('validates required arguments', async () => {
      await expect(syncTransactions({ userId: 'u', accountId: 'a' })).rejects.toThrow('Missing Supabase client')
      await expect(syncTransactions({ supabase: makeSupabase(), accountId: 'a' })).rejects.toThrow('Missing userId')
      await expect(syncTransactions({ supabase: makeSupabase(), userId: 'u' })).rejects.toThrow(
        'Missing connected Stripe account',
      )
    })
  })
})
