/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      }),
  },
}))

jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts, cb) => cb(),
  captureException: jest.fn(),
}))

let clientConfig = {}
const rpcMock = jest.fn(async () => ({ error: null }))

function makeSupabase() {
  const state = {
    link:
      'link' in clientConfig
        ? clientConfig.link
        : { invoice_id: 'inv-1', token: 'tok', expires_at: null, revoked_at: null },
    linkError: clientConfig.linkError ?? null,
    invoice:
      'invoice' in clientConfig
        ? clientConfig.invoice
        : {
            invoice_number: 'INV-1',
            user_id: 'secret-owner',
            status: 'sent',
            currency: 'USD',
            subtotal: 100,
            tax_rate_percentage: 0,
            tax_amount: 0,
            total: 100,
            due_date: '2026-07-01',
            created_at: '2026-06-01',
            client_name: 'ACME',
            notes: 'super secret note',
            items: [{ description: 'Work', quantity: 1, price: 100, total: 100 }],
            clients: { name: 'ACME' },
          },
    invoiceError: clientConfig.invoiceError ?? null,
  }

  const resolveMaybeSingle = (table) => {
    if (table === 'invoice_share_links') return { data: state.link, error: state.linkError }
    if (table === 'invoices') return { data: state.invoice, error: state.invoiceError }
    return { data: null, error: null }
  }

  const from = jest.fn((table) => {
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      maybeSingle: jest.fn(async () => resolveMaybeSingle(table)),
    }
    return builder
  })

  return { from, rpc: rpcMock, __state: state }
}

let currentClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => currentClient),
}))

const { GET } = require('@/app/api/public/invoice/[token]/route')

function makeContext(token) {
  return { params: Promise.resolve({ token }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  clientConfig = {}
  currentClient = makeSupabase()
})

describe('GET /api/public/invoice/[token]', () => {
  it('returns a sanitized invoice and bumps view analytics for an active token', async () => {
    const res = await GET({}, makeContext('tok'))
    expect(res.status).toBe(200)
    const payload = await res.json()

    // Whitelisted display fields are present, sensitive fields are not.
    expect(payload.invoice).toMatchObject({
      invoiceNumber: 'INV-1',
      total: 100,
      clientName: 'ACME',
    })
    const serialized = JSON.stringify(payload.invoice)
    expect(serialized).not.toContain('secret-owner')
    expect(serialized).not.toContain('super secret note')
    expect(payload.invoice.user_id).toBeUndefined()
    expect(payload.invoice.notes).toBeUndefined()

    // The active view was recorded via the atomic RPC.
    expect(rpcMock).toHaveBeenCalledWith('increment_invoice_share_view', { p_token: 'tok' })
    // No-store so a CDN never serves a stale view / caches the payload.
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 404 for an unknown token without bumping analytics', async () => {
    clientConfig = { link: null }
    currentClient = makeSupabase()
    const res = await GET({}, makeContext('missing'))
    expect(res.status).toBe(404)
    const payload = await res.json()
    expect(payload.reason).toBe('not_found')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 404 (revoked) for a revoked token', async () => {
    clientConfig = { link: { invoice_id: 'inv-1', token: 'tok', expires_at: null, revoked_at: '2026-06-01T00:00:00Z' } }
    currentClient = makeSupabase()
    const res = await GET({}, makeContext('tok'))
    expect(res.status).toBe(404)
    expect((await res.json()).reason).toBe('revoked')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 404 (expired) for an expired token', async () => {
    clientConfig = { link: { invoice_id: 'inv-1', token: 'tok', expires_at: '2000-01-01T00:00:00Z', revoked_at: null } }
    currentClient = makeSupabase()
    const res = await GET({}, makeContext('tok'))
    expect(res.status).toBe(404)
    expect((await res.json()).reason).toBe('expired')
  })

  it('returns 404 when the token is empty', async () => {
    const res = await GET({}, makeContext('   '))
    expect(res.status).toBe(404)
  })

  it('returns 500 when the link lookup errors', async () => {
    clientConfig = { linkError: { message: 'db down' } }
    currentClient = makeSupabase()
    const res = await GET({}, makeContext('tok'))
    expect(res.status).toBe(500)
  })
})
