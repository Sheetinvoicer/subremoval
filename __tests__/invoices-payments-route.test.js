/**
 * @jest-environment node
 */

// NextResponse.json -> a real Web Response so error + success paths share one API.
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

// Sentry is a no-op passthrough in tests.
jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts, cb) => cb(),
  captureException: jest.fn(),
}))

// Audit mirroring is fire-and-forget; assert it was called, don't hit the DB.
const recordAuditLog = jest.fn(async () => ({ ok: true, error: null }))
jest.mock('@/lib/audit/log', () => ({ recordAuditLog: (...args) => recordAuditLog(...args) }))

let mockUser = { id: 'user-1', email: 'owner@example.com' }
let mockUserError = null
const getUserMock = jest.fn(async () => ({ data: { user: mockUser }, error: mockUserError }))

// Per-test client config + a chainable builder that resolves by (table, op).
let clientConfig = {}

function makeSupabase() {
  const state = {
    // Use `in` so an explicit `invoice: null` (not-found case) isn't overridden
    // by the default via `??`.
    invoice: 'invoice' in clientConfig ? clientConfig.invoice : { id: 'inv-1', total: 100, status: 'sent', currency: 'USD' },
    invoiceError: clientConfig.invoiceError ?? null,
    payment:
      clientConfig.payment ??
      { id: 'pay-1', amount: 40, currency: 'USD', kind: 'payment', note: null, paid_at: 'p', created_at: 'c' },
    paymentError: clientConfig.paymentError ?? null,
    allPayments: clientConfig.allPayments ?? [{ amount: 40 }],
    paymentsError: clientConfig.paymentsError ?? null,
    updateError: clientConfig.updateError ?? null,
    inserts: [],
    updates: [],
  }

  const resolveSingle = (table, op) => {
    if (table === 'invoices' && op === 'select') return { data: state.invoice, error: state.invoiceError }
    if (table === 'invoice_payments' && op === 'insert') return { data: state.payment, error: state.paymentError }
    return { data: null, error: null }
  }

  const resolveList = (table, op) => {
    if (table === 'invoice_payments' && op === 'select') return { data: state.allPayments, error: state.paymentsError }
    if (table === 'invoices' && op === 'update') return { error: state.updateError }
    if (table === 'invoice_history' && op === 'insert') return { error: null }
    return { data: null, error: null }
  }

  const from = jest.fn((table) => {
    let op = 'select'
    const builder = {
      select: jest.fn(() => builder),
      insert: jest.fn((payload) => {
        op = 'insert'
        state.inserts.push({ table, payload })
        return builder
      }),
      update: jest.fn((payload) => {
        op = 'update'
        state.updates.push({ table, payload })
        return builder
      }),
      delete: jest.fn(() => {
        op = 'delete'
        return builder
      }),
      eq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      single: jest.fn(async () => resolveSingle(table, op)),
      then: (resolve, reject) => Promise.resolve(resolveList(table, op)).then(resolve, reject),
    }
    return builder
  })

  return { auth: { getUser: getUserMock }, from, __state: state }
}

let currentClient
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => currentClient),
}))

const { POST } = require('@/app/api/invoices/payments/route')

function makeRequest({ auth, body } = {}) {
  const headers = new Map()
  if (auth) headers.set('authorization', auth)
  return {
    headers: { get: (key) => headers.get(String(key).toLowerCase()) ?? null },
    json: async () => body ?? {},
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUser = { id: 'user-1', email: 'owner@example.com' }
  mockUserError = null
  clientConfig = {}
  currentClient = makeSupabase()
})

describe('POST /api/invoices/payments', () => {
  it('returns 401 without a valid bearer token', async () => {
    mockUser = null
    const res = await POST(makeRequest({ body: { invoiceId: 'inv-1', amount: 40 } }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when the amount is missing or zero', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', amount: 0 } }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when invoiceId is missing', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { amount: 40 } }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the invoice is not found (cross-user / RLS)', async () => {
    clientConfig = { invoice: null }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'nope', amount: 40 } }))
    expect(res.status).toBe(404)
  })

  it('records a partial payment without changing status and writes history + audit', async () => {
    // total 100, one $40 payment already recorded -> balance 60, not fully paid.
    clientConfig = { invoice: { id: 'inv-1', total: 100, status: 'sent', currency: 'USD' }, allPayments: [{ amount: 40 }] }
    currentClient = makeSupabase()

    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', amount: 40 } }))
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload).toMatchObject({ paid: 40, balance: 60, fullyPaid: false, status: 'sent' })

    const { __state } = currentClient
    // payment inserted, payment.recorded history appended, NO status update.
    expect(__state.inserts.find((i) => i.table === 'invoice_payments')).toBeTruthy()
    expect(__state.inserts.find((i) => i.table === 'invoice_history' && i.payload.action === 'payment.recorded')).toBeTruthy()
    expect(__state.updates.find((u) => u.table === 'invoices')).toBeFalsy()

    // Only the payment is mirrored to the audit trail (no invoice.paid).
    expect(recordAuditLog).toHaveBeenCalledTimes(1)
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'invoice.payment_recorded' }))
  })

  it('auto-marks the invoice paid once payments cover the total', async () => {
    // total 100, payments now sum to 100 -> fully paid; status flips from sent.
    clientConfig = { invoice: { id: 'inv-1', total: 100, status: 'sent', currency: 'USD' }, allPayments: [{ amount: 60 }, { amount: 40 }] }
    currentClient = makeSupabase()

    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', amount: 40 } }))
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload).toMatchObject({ paid: 100, balance: 0, fullyPaid: true, status: 'paid' })

    const { __state } = currentClient
    // status updated to paid, and an invoice.paid history row written.
    expect(__state.updates.find((u) => u.table === 'invoices' && u.payload.status === 'paid')).toBeTruthy()
    expect(__state.inserts.find((i) => i.table === 'invoice_history' && i.payload.action === 'invoice.paid')).toBeTruthy()

    // Both the payment and the auto-paid transition are mirrored to audit_logs.
    const actions = recordAuditLog.mock.calls.map((c) => c[0].action)
    expect(actions).toEqual(expect.arrayContaining(['invoice.payment_recorded', 'invoice.paid']))
  })

  it('does not re-flip status when the invoice is already paid', async () => {
    clientConfig = { invoice: { id: 'inv-1', total: 100, status: 'paid', currency: 'USD' }, allPayments: [{ amount: 100 }] }
    currentClient = makeSupabase()

    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', amount: 20, kind: 'credit' } }))
    expect(res.status).toBe(201)
    const { __state } = currentClient
    expect(__state.updates.find((u) => u.table === 'invoices')).toBeFalsy()
    const actions = recordAuditLog.mock.calls.map((c) => c[0].action)
    expect(actions).not.toContain('invoice.paid')
  })

  it('returns 500 when the payment insert fails', async () => {
    clientConfig = { paymentError: { message: 'insert boom' } }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', amount: 40 } }))
    expect(res.status).toBe(500)
  })
})
