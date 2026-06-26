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

let mockUser = { id: 'user-1', email: 'owner@example.com' }
let mockUserError = null
const getUserMock = jest.fn(async () => ({ data: { user: mockUser }, error: mockUserError }))

let clientConfig = {}

function makeSupabase() {
  const state = {
    versions:
      clientConfig.versions ?? [
        { id: 'd3', invoice_id: null, draft_key: 'new', version: 3, payload: { a: 1 }, created_at: 'c3' },
      ],
    versionsError: clientConfig.versionsError ?? null,
    inserted:
      clientConfig.inserted ?? {
        id: 'd4',
        invoice_id: null,
        draft_key: 'new',
        version: 4,
        payload: {},
        created_at: 'c4',
      },
    insertError: clientConfig.insertError ?? null,
    deleteError: clientConfig.deleteError ?? null,
    inserts: [],
    deletes: [],
    eqCalls: [],
    lteCalls: [],
  }

  const resolveSingle = (table, op) => {
    if (table === 'invoice_drafts' && op === 'insert') return { data: state.inserted, error: state.insertError }
    return { data: null, error: null }
  }

  const resolveList = (table, op) => {
    if (table === 'invoice_drafts' && op === 'select') return { data: state.versions, error: state.versionsError }
    if (table === 'invoice_drafts' && op === 'delete') return { error: state.deleteError }
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
      delete: jest.fn(() => {
        op = 'delete'
        state.deletes.push({ table })
        return builder
      }),
      eq: jest.fn((col, val) => {
        state.eqCalls.push([col, val])
        return builder
      }),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      lte: jest.fn((col, val) => {
        state.lteCalls.push([col, val])
        return builder
      }),
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

const { GET, POST, DELETE } = require('@/app/api/invoices/drafts/route')

function makeRequest({ auth, body, url } = {}) {
  const headers = new Map()
  if (auth) headers.set('authorization', auth)
  return {
    url: url || 'http://localhost/api/invoices/drafts',
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

describe('GET /api/invoices/drafts', () => {
  it('returns 401 without a valid bearer token', async () => {
    mockUser = null
    const res = await GET(makeRequest({ url: 'http://localhost/api/invoices/drafts?invoiceId=new' }))
    expect(res.status).toBe(401)
  })

  it('returns the latest version and the full version list', async () => {
    const res = await GET(makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/drafts?invoiceId=new' }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.versions).toHaveLength(1)
    expect(payload.latest).toMatchObject({ version: 3, draft_key: 'new' })
  })
})

describe('POST /api/invoices/drafts', () => {
  it('returns 401 without a valid bearer token', async () => {
    mockUser = null
    const res = await POST(makeRequest({ body: { payload: { a: 1 } } }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when the payload is missing or not an object', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { payload: 'nope' } }))
    expect(res.status).toBe(400)
  })

  it('returns 413 when the payload is too large', async () => {
    const big = { blob: 'x'.repeat(200_001) }
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { payload: big } }))
    expect(res.status).toBe(413)
  })

  it('saves the next version for a new-invoice draft', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'new', payload: { client: 'c1' } } }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.draft).toMatchObject({ version: 4 })

    const { __state } = currentClient
    const insert = __state.inserts.find((i) => i.table === 'invoice_drafts')
    expect(insert.payload).toMatchObject({ draft_key: 'new', invoice_id: null, version: 4 })
  })

  it('scopes the draft to an existing invoice id', async () => {
    const res = await POST(
      makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-9', payload: { client: 'c1' } } }),
    )
    expect(res.status).toBe(200)
    const { __state } = currentClient
    const insert = __state.inserts.find((i) => i.table === 'invoice_drafts')
    expect(insert.payload).toMatchObject({ draft_key: 'inv-9', invoice_id: 'inv-9' })
  })

  it('prunes versions older than the retained window', async () => {
    clientConfig = { versions: [{ version: 12 }] } // next version = 13 -> prune <= 3
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'new', payload: { a: 1 } } }))
    expect(res.status).toBe(200)
    const { __state } = currentClient
    expect(__state.deletes.find((d) => d.table === 'invoice_drafts')).toBeTruthy()
    expect(__state.lteCalls).toContainEqual(['version', 3])
  })

  it('returns 500 when the insert fails', async () => {
    clientConfig = { insertError: { message: 'insert boom' } }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'new', payload: { a: 1 } } }))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/invoices/drafts', () => {
  it('returns 401 without a valid bearer token', async () => {
    mockUser = null
    const res = await DELETE(makeRequest({ url: 'http://localhost/api/invoices/drafts?invoiceId=new' }))
    expect(res.status).toBe(401)
  })

  it('discards every version for the draft key', async () => {
    const res = await DELETE(
      makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/drafts?invoiceId=inv-9' }),
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ ok: true })
    const { __state } = currentClient
    expect(__state.deletes.find((d) => d.table === 'invoice_drafts')).toBeTruthy()
    expect(__state.eqCalls).toContainEqual(['draft_key', 'inv-9'])
  })
})
