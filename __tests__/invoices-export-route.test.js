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

// @react-pdf/renderer is ESM-only and not transformed by Jest, so mock the PDF
// module to a tiny Buffer; the route's content-type/headers logic is what we test.
jest.mock('@/lib/invoices/pdf', () => ({
  renderInvoiceListPdf: jest.fn(async () => Buffer.from('%PDF-1.7 mock pdf')),
}))

// Keep parseInvoiceParams + MAX_EXPORT_ROWS real, but stub the DB query so we can
// assert the filters it receives and control the rows it returns.
const exportQuerySpy = jest.fn()
let exportRows = []
let exportError = null
jest.mock('@/lib/invoices/query', () => {
  const actual = jest.requireActual('@/lib/invoices/query')
  return {
    ...actual,
    buildInvoiceExportQuery: (_supabase, userId, params) => {
      exportQuerySpy(userId, params)
      return { rows: Promise.resolve({ data: exportRows, error: exportError }) }
    },
  }
})

let mockUser = { id: 'user-1' }
let mockUserError = null
const getUserMock = jest.fn(async () => ({ data: { user: mockUser }, error: mockUserError }))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(),
  })),
}))

const { renderInvoiceListPdf } = require('@/lib/invoices/pdf')
const { MAX_EXPORT_ROWS } = jest.requireActual('@/lib/invoices/query')
const { POST } = require('@/app/api/invoices/export/route')

function makeRequest({ auth, body } = {}) {
  const headers = new Map()
  if (auth) headers.set('authorization', auth)
  return {
    headers: { get: (key) => headers.get(String(key).toLowerCase()) ?? null },
    json: async () => body ?? {},
  }
}

const SAMPLE_ROWS = [
  {
    id: 'a',
    invoice_number: '1001',
    client_name: 'Acme',
    project_name: 'Web',
    status: 'paid',
    currency: 'USD',
    subtotal: 1000,
    tax_amount: 190,
    total: 1190,
    due_date: '2026-06-20',
    created_at: '2026-06-01',
  },
]

describe('POST /api/invoices/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { id: 'user-1' }
    mockUserError = null
    exportRows = SAMPLE_ROWS
    exportError = null
  })

  it('returns 401 without a valid bearer token', async () => {
    mockUser = null
    const res = await POST(makeRequest({ body: { format: 'csv' } }))
    expect(res.status).toBe(401)
  })

  it('returns a localized CSV attachment honoring the active filters', async () => {
    const res = await POST(
      makeRequest({
        auth: 'Bearer token-123',
        body: { format: 'csv', locale: 'de', params: { status: 'paid', q: 'acme' } },
      }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/csv/)
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment/)
    expect(res.headers.get('Content-Disposition')).toMatch(/\.csv"?$/)

    // Filters were parsed and passed through to the export query.
    expect(exportQuerySpy).toHaveBeenCalledWith('user-1', { status: ['paid'], search: 'acme' })

    // Read raw bytes: Response.text() strips the leading BOM on decode, so we
    // assert the UTF-8 BOM directly on the bytes and decode via Buffer (keeps it).
    const buffer = Buffer.from(await res.arrayBuffer())
    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xef, 0xbb, 0xbf])
    const text = buffer.toString('utf8')
    expect(text).toContain('1001')
    expect(text).toContain('Acme')
  })

  it('returns a PDF attachment for format=pdf', async () => {
    const res = await POST(
      makeRequest({ auth: 'Bearer token-123', body: { format: 'pdf', locale: 'en' } }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="invoices-.*\.pdf"/)
    expect(renderInvoiceListPdf).toHaveBeenCalledTimes(1)

    const buffer = Buffer.from(await res.arrayBuffer())
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('returns 413 with a code when the result exceeds MAX_EXPORT_ROWS', async () => {
    // The query fetches one extra row past the cap as an overflow sentinel.
    exportRows = Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => ({
      id: String(i),
      invoice_number: String(i),
      currency: 'USD',
      total: 1,
    }))

    const res = await POST(makeRequest({ auth: 'Bearer token-123', body: { format: 'csv' } }))
    expect(res.status).toBe(413)
    const payload = await res.json()
    expect(payload.code).toBe('EXPORT_TOO_LARGE')
    expect(payload.max).toBe(MAX_EXPORT_ROWS)
  })

  it('returns 500 when the export query errors', async () => {
    exportError = { message: 'boom' }
    const res = await POST(makeRequest({ auth: 'Bearer token-123', body: { format: 'csv' } }))
    expect(res.status).toBe(500)
  })
})
