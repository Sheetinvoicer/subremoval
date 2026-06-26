/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts, cb) => cb(),
  captureException: jest.fn(),
}))

// Mock the AI lib so the real Anthropic SDK is never loaded; keep a real error
// class so the route's `instanceof InvoiceAiUnavailableError` branch is exercised.
const mockGenerate = jest.fn()
jest.mock('@/lib/ai/invoice', () => {
  class InvoiceAiUnavailableError extends Error {
    constructor(message = 'AI generation is not configured') {
      super(message)
      this.name = 'InvoiceAiUnavailableError'
    }
  }
  return {
    __esModule: true,
    generateInvoiceContent: (...args) => mockGenerate(...args),
    InvoiceAiUnavailableError,
    MAX_BRIEF_LENGTH: 2000,
  }
})

// Cookie-session Supabase client (auth + the subscriptions lookup used by gating).
let mockUser = { id: 'user-1' }
let mockPlan = 'Pro'
const getUserMock = jest.fn(async () => ({ data: { user: mockUser }, error: null }))
const fromMock = jest.fn(() => ({
  select: () => ({
    eq: () => ({
      maybeSingle: async () => ({ data: mockPlan ? { plan: mockPlan } : null, error: null }),
    }),
  }),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: fromMock })),
}))

const { InvoiceAiUnavailableError } = require('@/lib/ai/invoice')
const { POST } = require('@/app/api/invoices/ai-generate/route')

const makeRequest = (body) => ({ json: async () => body })

describe('POST /api/invoices/ai-generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { id: 'user-1' }
    mockPlan = 'Pro'
  })

  it('returns 400 when the brief is missing', async () => {
    const res = await POST(makeRequest({ currency: 'USD' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('brief_required')
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns 401 when not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest({ brief: 'Build a website' }))
    expect(res.status).toBe(401)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns 403 when the plan does not include the AI assistant', async () => {
    mockPlan = 'Free'
    const res = await POST(makeRequest({ brief: 'Build a website' }))
    expect(res.status).toBe(403)
    const payload = await res.json()
    expect(payload.code).toBe('feature_locked')
    expect(payload.plan).toBe('Free')
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns generated items + notes for an allowed plan', async () => {
    mockGenerate.mockResolvedValue({
      items: [{ description: 'Design', quantity: 1, price: 500 }],
      notes: 'Net 30',
    })
    const res = await POST(makeRequest({ brief: 'Design a logo', currency: 'EUR', locale: 'de' }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.success).toBe(true)
    expect(payload.items).toHaveLength(1)
    expect(payload.notes).toBe('Net 30')
    expect(mockGenerate).toHaveBeenCalledWith({ brief: 'Design a logo', currency: 'EUR', locale: 'de' })
  })

  it('returns 503 when the AI provider is not configured', async () => {
    mockGenerate.mockRejectedValue(new InvoiceAiUnavailableError())
    const res = await POST(makeRequest({ brief: 'Design a logo' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('ai_unavailable')
  })

  it('returns 502 when generation fails unexpectedly', async () => {
    mockGenerate.mockRejectedValue(new Error('upstream boom'))
    const res = await POST(makeRequest({ brief: 'Design a logo' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('ai_error')
  })
})
