const sendEmailMock = jest.fn()

const lteMock = jest.fn()
const eqTemplatesMock = jest.fn(() => ({ lte: lteMock }))
const selectTemplatesMock = jest.fn(() => ({ eq: eqTemplatesMock }))

const singleInsertMock = jest.fn()
const selectInsertMock = jest.fn(() => ({ single: singleInsertMock }))
const insertMock = jest.fn(() => ({ select: selectInsertMock }))

const eqUpdateMock = jest.fn().mockResolvedValue({ error: null })
const updateMock = jest.fn(() => ({ eq: eqUpdateMock }))

const fromMock = jest.fn((table) => {
  if (table === 'recurring_invoices') {
    return {
      select: selectTemplatesMock,
      update: updateMock,
    }
  }

  if (table === 'invoices') {
    return {
      insert: insertMock,
    }
  }

  return {}
})

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendEmailMock,
    },
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: fromMock,
  })),
}))

const { GET } = require('@/app/api/cron/generate-recurring/route')

describe('Generate recurring cron route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'secret-123'
    process.env.RESEND_API_KEY = 're_test_123'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('returns unauthorized when cron secret is missing/invalid', async () => {
    const req = {
      headers: { get: () => 'Bearer wrong' },
    }

    const res = await GET(req)
    const payload = await res.json()

    expect(res.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('generates invoice, updates next date, and sends email for active due template', async () => {
    lteMock.mockResolvedValue({
      data: [
        {
          id: 'rec-1',
          user_id: 'user-1',
          client_id: 'client-1',
          amount: 99,
          currency: 'USD',
          frequency: 'monthly',
          notes: 'Recurring design retainer',
          clients: { name: 'Jane', email: 'jane@example.com' },
        },
      ],
      error: null,
    })

    singleInsertMock.mockResolvedValue({
      data: { id: 'inv-1', invoice_number: 'INV-2026-1' },
      error: null,
    })

    const req = {
      headers: { get: () => 'Bearer secret-123' },
    }

    const res = await GET(req)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.processed).toBe(1)
    expect(insertMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ next_date: expect.any(String) }))
    expect(sendEmailMock).toHaveBeenCalled()
  })
})
