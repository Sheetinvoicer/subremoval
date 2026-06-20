jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}))

const sendMock = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}))

const singleMock = jest.fn()
const eqMock = jest.fn(() => ({ single: singleMock }))
const selectMock = jest.fn(() => ({ eq: eqMock }))
const updateEqMock = jest.fn()
const updateMock = jest.fn(() => ({ eq: updateEqMock }))
const fromMock = jest.fn((table) => {
  if (table === 'invoices') {
    return {
      select: selectMock,
      update: updateMock,
    }
  }
  return {}
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: fromMock,
  })),
}))

const { POST } = require('@/app/api/send-invoice/route')

describe('POST /api/send-invoice', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    updateEqMock.mockResolvedValue({ error: null })
  })

  it('returns 400 when invoice identifiers are missing', async () => {
    const res = await POST({ json: async () => ({}) })
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error).toMatch(/invoiceId or invoiceIds is required/i)
  })

  it('returns bulk results with partial failures', async () => {
    singleMock
      .mockResolvedValueOnce({
        data: {
          id: 'inv-1',
          invoice_number: '1001',
          total: 100,
          currency: 'USD',
          due_date: '2026-06-20',
          notes: 'Thanks',
          status: 'draft',
          clients: { name: 'Alice', email: 'alice@example.com' },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'inv-2',
          invoice_number: '1002',
          total: 200,
          currency: 'USD',
          due_date: '2026-06-20',
          notes: '',
          status: 'draft',
          clients: { name: 'Bob', email: '' },
        },
        error: null,
      })

    sendMock.mockResolvedValueOnce({ error: null })

    const res = await POST({ json: async () => ({ invoiceIds: ['inv-1', 'inv-2'] }) })
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.total).toBe(2)
    expect(payload.sent).toBe(1)
    expect(payload.failed).toBe(1)
    expect(payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invoiceId: 'inv-1', success: true }),
        expect.objectContaining({ invoiceId: 'inv-2', success: false }),
      ]),
    )
  })
})
