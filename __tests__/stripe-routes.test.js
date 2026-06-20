const createMock = jest.fn()
const constructEventMock = jest.fn()

const eqMock = jest.fn().mockResolvedValue({ data: null, error: null })
const updateMock = jest.fn(() => ({ eq: eqMock }))
const fromMock = jest.fn(() => ({ update: updateMock }))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}))

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: createMock } },
    webhooks: { constructEvent: constructEventMock },
  }))
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: fromMock,
  })),
}))

const { POST: createCheckoutPost } = require('@/app/api/stripe/create-checkout/route')
const { POST: webhookPost } = require('@/app/api/stripe/webhook/route')

describe('Stripe routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('creates checkout session with payment intent metadata', async () => {
    createMock.mockResolvedValue({ id: 'cs_test_123', url: 'https://stripe.test/session' })

    const req = {
      json: async () => ({
        invoiceId: 'inv-1',
        invoiceNumber: '1001',
        amount: 12.34,
        clientName: 'Jane',
        clientEmail: 'jane@example.com',
      }),
      nextUrl: { origin: 'http://localhost:3000' },
    }

    const res = await createCheckoutPost(req)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.url).toBe('https://stripe.test/session')
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_intent_data: {
          metadata: {
            invoiceId: 'inv-1',
            invoiceNumber: '1001',
          },
        },
      }),
    )
  })

  it('returns 500 when Stripe secret key is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY

    const req = {
      json: async () => ({ invoiceId: 'inv-1', invoiceNumber: '1001', amount: 10 }),
      nextUrl: { origin: 'http://localhost:3000' },
    }

    const res = await createCheckoutPost(req)
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error).toMatch(/STRIPE_SECRET_KEY/)
  })

  it('handles checkout.session.completed webhook and updates invoice status', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { invoiceId: 'inv-1' } } },
    })

    const req = {
      headers: { get: (key) => (key === 'stripe-signature' ? 'sig_123' : null) },
      text: async () => 'raw-body',
    }

    const res = await webhookPost(req)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.received).toBe(true)
    expect(updateMock).toHaveBeenCalledWith({ status: 'paid' })
    expect(eqMock).toHaveBeenCalledWith('id', 'inv-1')
  })
})