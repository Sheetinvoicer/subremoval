const retrieveMock = jest.fn()
const subUpdateMock = jest.fn()
const subListMock = jest.fn()
const custListMock = jest.fn()

const getUserMock = jest.fn()
const maybeSingleMock = jest.fn()
const updateEqMock = jest.fn().mockResolvedValue({ error: null })
const updateMock = jest.fn(() => ({ eq: updateEqMock }))
const selectEqMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }))
const selectMock = jest.fn(() => ({ eq: selectEqMock }))
const fromMock = jest.fn(() => ({ select: selectMock, update: updateMock }))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({ status: init.status || 200, json: async () => body }),
  },
}))

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    subscriptions: { retrieve: retrieveMock, update: subUpdateMock, list: subListMock },
    customers: { list: custListMock },
  })),
)

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: fromMock })),
}))

const { POST } = require('@/app/api/stripe/change-plan/route')

const makeReq = (body) => ({ json: async () => body, nextUrl: { origin: 'http://localhost:3000' } })

describe('POST /api/stripe/change-plan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro'
    process.env.STRIPE_BUSINESS_PRICE_ID = 'price_business'
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'u@example.com' } }, error: null })
    maybeSingleMock.mockResolvedValue({ data: { stripe_subscription_id: 'sub_1' }, error: null })
    retrieveMock.mockResolvedValue({
      id: 'sub_1',
      metadata: {},
      items: { data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
    })
    subUpdateMock.mockResolvedValue({ cancel_at_period_end: false })
  })

  it('rejects Enterprise with a contact-sales action', async () => {
    const res = await POST(makeReq({ plan: 'Enterprise' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.action).toBe('contact_sales')
    expect(subUpdateMock).not.toHaveBeenCalled()
  })

  it('directs Free downgrades to cancellation', async () => {
    const res = await POST(makeReq({ plan: 'Free' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.action).toBe('cancel')
  })

  it('upgrades Pro to Business with immediate proration', async () => {
    const res = await POST(makeReq({ plan: 'Business' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.changed).toBe(true)
    expect(body.plan).toBe('Business')
    expect(body.previousPlan).toBe('Pro')
    expect(subUpdateMock).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', price: 'price_business' }],
        proration_behavior: 'create_prorations',
      }),
    )
    expect(updateMock).toHaveBeenCalled()
  })

  it('is a no-op when already on the target plan', async () => {
    const res = await POST(makeReq({ plan: 'Pro' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.changed).toBe(false)
    expect(subUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 409 with a checkout action when there is no subscription', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    subListMock.mockResolvedValue({ data: [] })
    custListMock.mockResolvedValue({ data: [] })

    const res = await POST(makeReq({ plan: 'Business' }))
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.action).toBe('checkout')
  })

  it('requires authentication', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeReq({ plan: 'Business' }))
    const body = await res.json()
    expect(res.status).toBe(401)
  })
})
