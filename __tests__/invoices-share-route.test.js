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

const recordAuditLog = jest.fn(async () => ({ ok: true, error: null }))
jest.mock('@/lib/audit/log', () => ({ recordAuditLog: (...args) => recordAuditLog(...args) }))

let mockUser = { id: 'user-1', email: 'owner@example.com' }
let mockUserError = null
const getUserMock = jest.fn(async () => ({ data: { user: mockUser }, error: mockUserError }))

let clientConfig = {}

function makeSupabase() {
  const state = {
    invoice: 'invoice' in clientConfig ? clientConfig.invoice : { id: 'inv-1' },
    links: clientConfig.links ?? [
      { id: 'link-1', token: 'tok', expires_at: null, revoked_at: null, view_count: 3, last_viewed_at: 'v', created_at: 'c' },
    ],
    link: clientConfig.link ?? { id: 'link-2', token: 'tok2', expires_at: null, revoked_at: null, view_count: 0, last_viewed_at: null, created_at: 'c2' },
    linkError: clientConfig.linkError ?? null,
    listError: clientConfig.listError ?? null,
    updateError: clientConfig.updateError ?? null,
    inserts: [],
    updates: [],
  }

  const resolveSingle = (table, op) => {
    if (table === 'invoices' && op === 'select') return { data: state.invoice, error: null }
    if (table === 'invoice_share_links' && op === 'insert') return { data: state.link, error: state.linkError }
    return { data: null, error: null }
  }

  const resolveList = (table, op) => {
    if (table === 'invoice_share_links' && op === 'select') return { data: state.links, error: state.listError }
    if (table === 'invoice_share_links' && op === 'update') return { error: state.updateError }
    if (table === 'invoice_history' && op === 'insert') return { error: null }
    return { data: null, error: null }
  }

  const from = jest.fn((table) => {
    let op = 'select'
    const builder = {
      select: jest.fn(() => builder),
      insert: jest.fn((payload) => {
        op = 'insert'
        state.inserts.push({ table, payload })
        return builder
      }),
      update: jest.fn((payload) => {
        op = 'update'
        state.updates.push({ table, payload })
        return builder
      }),
      eq: jest.fn(() => builder),
      is: jest.fn(() => builder),
      order: jest.fn(() => builder),
      single: jest.fn(async () => resolveSingle(table, op)),
      then: (resolve, reject) => Promise.resolve(resolveList(table, op)).then(resolve, reject),
    }
    return builder
  })

  return { auth: { getUser: getUserMock }, from, __state: state }
}

let currentClient
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => currentClient),
}))

const { GET, POST, DELETE } = require('@/app/api/invoices/share/route')

function makeRequest({ auth, body, url } = {}) {
  const headers = new Map()
  if (auth) headers.set('authorization', auth)
  return {
    url: url || 'http://localhost/api/invoices/share',
    headers: { get: (key) => headers.get(String(key).toLowerCase()) ?? null },
    json: async () => body ?? {},
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUser = { id: 'user-1', email: 'owner@example.com' }
  mockUserError = null
  clientConfig = {}
  currentClient = makeSupabase()
})

describe('GET /api/invoices/share', () => {
  it('returns 401 without a bearer token', async () => {
    mockUser = null
    const res = await GET(makeRequest({ url: 'http://localhost/api/invoices/share?invoiceId=inv-1' }))
    expect(res.status).toBe(401)
  })

  it('returns the most recent link for the invoice', async () => {
    const res = await GET(makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/share?invoiceId=inv-1' }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.link).toMatchObject({ id: 'link-1', view_count: 3 })
  })

  it('returns null when there is no link', async () => {
    clientConfig = { links: [] }
    currentClient = makeSupabase()
    const res = await GET(makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/share?invoiceId=inv-1' }))
    const payload = await res.json()
    expect(payload.link).toBeNull()
  })
})

describe('POST /api/invoices/share', () => {
  it('returns 401 without a bearer token', async () => {
    mockUser = null
    const res = await POST(makeRequest({ body: { invoiceId: 'inv-1' } }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the invoice is not owned (RLS)', async () => {
    clientConfig = { invoice: null }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'nope' } }))
    expect(res.status).toBe(404)
  })

  it('creates a link with an unguessable token, revokes priors, and writes history + audit', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', expiresInDays: 7 } }))
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.link).toMatchObject({ id: 'link-2' })

    const { __state } = currentClient
    // A new share link was inserted with a 64-hex-char token + computed expiry.
    const inserted = __state.inserts.find((i) => i.table === 'invoice_share_links')
    expect(inserted.payload.token).toMatch(/^[0-9a-f]{64}$/)
    expect(typeof inserted.payload.expires_at).toBe('string')
    // Prior live links were revoked before insert.
    expect(__state.updates.find((u) => u.table === 'invoice_share_links' && u.payload.revoked_at)).toBeTruthy()
    // History + audit recorded the creation.
    expect(__state.inserts.find((i) => i.table === 'invoice_history' && i.payload.action === 'share.created')).toBeTruthy()
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'invoice.share_created' }))
  })

  it('creates a non-expiring link when no expiry is provided', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1' } }))
    expect(res.status).toBe(201)
    const inserted = currentClient.__state.inserts.find((i) => i.table === 'invoice_share_links')
    expect(inserted.payload.expires_at).toBeNull()
  })

  it('returns 500 when the insert fails', async () => {
    clientConfig = { link: null, linkError: { message: 'boom' } }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1' } }))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/invoices/share (revoke)', () => {
  it('returns 401 without a bearer token', async () => {
    mockUser = null
    const res = await DELETE(makeRequest({ url: 'http://localhost/api/invoices/share?id=link-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 without id or invoiceId', async () => {
    const res = await DELETE(makeRequest({ auth: 'Bearer t' }))
    expect(res.status).toBe(400)
  })

  it('revokes a link by id and records history + audit', async () => {
    const res = await DELETE(makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/share?id=link-1' }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)

    const { __state } = currentClient
    expect(__state.updates.find((u) => u.table === 'invoice_share_links' && u.payload.revoked_at)).toBeTruthy()
    expect(__state.inserts.find((i) => i.table === 'invoice_history' && i.payload.action === 'share.revoked')).toBeTruthy()
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'invoice.share_revoked' }))
  })
})
