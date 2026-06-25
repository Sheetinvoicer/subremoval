const mockConstructEvent = jest.fn()
const mockMaybeSingle = jest.fn()
const mockSync = jest.fn()
const mockReconcile = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}))

jest.mock('@/lib/bank/connect', () => ({
  getStripeClient: jest.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}))

jest.mock('@/lib/subscriptions/store', () => ({
  createAdminClient: jest.fn(() => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: mockMaybeSingle,
      }
      return builder
    },
  })),
}))

jest.mock('@/lib/bank/sync', () => ({
  syncTransactions: (...args) => mockSync(...args),
}))

jest.mock('@/lib/bank/reconcile', () => ({
  autoReconcile: (...args) => mockReconcile(...args),
}))

const { POST: bankWebhookPost } = require('@/app/api/webhooks/stripe/bank/route')

function makeRequest({ signature = 'sig_123', body = 'raw-body' } = {}) {
  return {
    headers: { get: (key) => (key === 'stripe-signature' ? signature : null) },
    text: async () => body,
  }
}

describe('Stripe bank webhook route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_BANK_WEBHOOK_SECRET = 'whsec_bank_123'
    delete process.env.STRIPE_WEBHOOK_SECRET
    mockMaybeSingle.mockResolvedValue({ data: { user_id: 'user-1' }, error: null })
    mockSync.mockResolvedValue({ synced: 3, transactions: [] })
    mockReconcile.mockResolvedValue({ matched: 2, matches: [] })
  })

  it('returns 500 when no webhook secret is configured', async () => {
    delete process.env.STRIPE_BANK_WEBHOOK_SECRET
    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error).toMatch(/STRIPE_BANK_WEBHOOK_SECRET/)
  })

  it('falls back to STRIPE_WEBHOOK_SECRET when the dedicated secret is absent', async () => {
    delete process.env.STRIPE_BANK_WEBHOOK_SECRET
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_shared'
    mockConstructEvent.mockReturnValue({ type: 'balance.available', account: 'acct_1' })

    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.received).toBe(true)
    expect(mockConstructEvent).toHaveBeenCalledWith('raw-body', 'sig_123', 'whsec_shared')
  })

  it('returns 400 when the stripe-signature header is missing', async () => {
    const res = await bankWebhookPost(makeRequest({ signature: null }))
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error).toMatch(/stripe-signature/)
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad sig')
    })

    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error).toMatch(/bad sig/)
    expect(mockSync).not.toHaveBeenCalled()
  })

  it('acknowledges and ignores unrelated event types', async () => {
    mockConstructEvent.mockReturnValue({ type: 'customer.created', account: 'acct_1' })

    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toEqual({ received: true, ignored: 'customer.created' })
    expect(mockSync).not.toHaveBeenCalled()
    expect(mockReconcile).not.toHaveBeenCalled()
  })

  it('syncs and auto-reconciles when a linked account fires a balance event', async () => {
    mockConstructEvent.mockReturnValue({ type: 'balance.available', account: 'acct_1' })

    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toEqual({ received: true, event: 'balance.available', synced: 3, matched: 2 })
    expect(mockSync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', accountId: 'acct_1' }),
    )
    expect(mockReconcile).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }))
  })

  it('acknowledges without syncing when the account is not linked to a user', async () => {
    mockConstructEvent.mockReturnValue({ type: 'payout.paid', account: 'acct_unknown' })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.reason).toBe('no_linked_user')
    expect(mockSync).not.toHaveBeenCalled()
    expect(mockReconcile).not.toHaveBeenCalled()
  })

  it('returns 500 when processing throws so Stripe retries on its backoff schedule', async () => {
    mockConstructEvent.mockReturnValue({ type: 'balance.available', account: 'acct_1' })
    mockSync.mockRejectedValue(new Error('db down'))

    const res = await bankWebhookPost(makeRequest())
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error).toMatch(/db down/)
  })
})
