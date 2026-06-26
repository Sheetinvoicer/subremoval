const callAIMock = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      ok: (init.status || 200) < 400,
      json: async () => body,
    }),
  },
}))

jest.mock('@/lib/ai/config', () => ({
  __esModule: true,
  default: (...args) => callAIMock(...args),
}))

// The dashboard chat route now talks to Claude through `@/lib/ai/assistant`
// (the Anthropic SDK) rather than the legacy `@/lib/ai/config` helper. Mock it
// so the route-level integration test exercises auth + plan gating without the
// network; the SDK-wiring details are covered by agents-chat-assistant.test.ts.
class AssistantAiUnavailableErrorMock extends Error {
  constructor(message = 'AI assistant is not configured') {
    super(message)
    this.name = 'AssistantAiUnavailableError'
  }
}
jest.mock('@/lib/ai/assistant', () => ({
  __esModule: true,
  MAX_MESSAGE_LENGTH: 2000,
  AssistantAiUnavailableError: AssistantAiUnavailableErrorMock,
  generateAssistantReply: ({ message }) => callAIMock(message),
}))

// The AI action route is gated behind auth + the paid AI feature.
let aiSupabase = null
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => aiSupabase),
}))

function makeAiSupabase({ user = { id: 'u1' }, plan = 'Pro' } = {}) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: user ? { plan } : null, error: null }),
  }
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: jest.fn(() => builder),
  }
}

describe('AI API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    aiSupabase = makeAiSupabase({ plan: 'Pro' })
  })

  it('chat route validates empty message', async () => {
    const { POST } = require('@/app/api/agents/chat/route')

    const res = await POST({ json: async () => ({ message: '   ' }) })
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error).toMatch(/message is required/i)
  })

  it('chat route returns AI response for valid prompt', async () => {
    const { POST } = require('@/app/api/agents/chat/route')
    callAIMock.mockResolvedValue('Use recurring invoices for retainer clients.')

    const res = await POST({ json: async () => ({ message: 'How can I reduce late payments?' }) })
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.response).toContain('recurring invoices')
    expect(callAIMock).toHaveBeenCalled()
  })

  it('action route validates action and forwards prompt', async () => {
    const { POST } = require('@/app/api/ai/action/route')
    callAIMock.mockResolvedValue('I can draft a payment reminder for INV-1024.')

    const badRes = await POST({ json: async () => ({}) })
    const badPayload = await badRes.json()
    expect(badRes.status).toBe(400)
    expect(badPayload.error).toMatch(/action is required/i)

    const okRes = await POST({ json: async () => ({ action: 'draft_reminder', payload: { invoice: 'INV-1024' } }) })
    const okPayload = await okRes.json()
    expect(okRes.status).toBe(200)
    expect(okPayload.response).toContain('payment reminder')
  })

  it('action route locks the AI feature for Free plans', async () => {
    aiSupabase = makeAiSupabase({ plan: 'Free' })
    const { POST } = require('@/app/api/ai/action/route')

    const res = await POST({ json: async () => ({ action: 'draft_reminder', payload: { invoice: 'INV-1024' } }) })
    const payload = await res.json()
    expect(res.status).toBe(403)
    expect(payload.code).toBe('feature_locked')
    expect(callAIMock).not.toHaveBeenCalled()
  })
})
