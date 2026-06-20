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

describe('AI API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
