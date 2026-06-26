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

let mockUser = { id: 'user-1', email: 'owner@example.com' }
let mockUserError = null
const getUserMock = jest.fn(async () => ({ data: { user: mockUser }, error: mockUserError }))

let clientConfig = {}

function makeSupabase() {
  const state = {
    invoice: 'invoice' in clientConfig ? clientConfig.invoice : { id: 'inv-1' },
    comments: clientConfig.comments ?? [{ id: 'c-1', invoice_id: 'inv-1', parent_id: null, audience: 'team', body: 'hi', created_at: 't1' }],
    comment: clientConfig.comment ?? { id: 'c-2', invoice_id: 'inv-1', parent_id: null, audience: 'team', body: 'new', created_at: 't2' },
    commentError: clientConfig.commentError ?? null,
    listError: clientConfig.listError ?? null,
    deleteError: clientConfig.deleteError ?? null,
    inserts: [],
    deletes: [],
  }

  const resolveSingle = (table, op) => {
    if (table === 'invoices' && op === 'select') return { data: state.invoice, error: null }
    if (table === 'invoice_comments' && op === 'insert') return { data: state.comment, error: state.commentError }
    return { data: null, error: null }
  }

  const resolveList = (table, op) => {
    if (table === 'invoice_comments' && op === 'select') return { data: state.comments, error: state.listError }
    if (table === 'invoice_comments' && op === 'delete') return { error: state.deleteError }
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

const { GET, POST, DELETE } = require('@/app/api/invoices/comments/route')

function makeRequest({ auth, body, url } = {}) {
  const headers = new Map()
  if (auth) headers.set('authorization', auth)
  return {
    url: url || 'http://localhost/api/invoices/comments',
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

describe('GET /api/invoices/comments', () => {
  it('returns 401 without a valid bearer token', async () => {
    mockUser = null
    const res = await GET(makeRequest({ url: 'http://localhost/api/invoices/comments?invoiceId=inv-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 without invoiceId', async () => {
    const res = await GET(makeRequest({ auth: 'Bearer t' }))
    expect(res.status).toBe(400)
  })

  it('lists comments for the invoice', async () => {
    const res = await GET(makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/comments?invoiceId=inv-1' }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.comments).toHaveLength(1)
    expect(payload.comments[0]).toMatchObject({ id: 'c-1', body: 'hi' })
  })
})

describe('POST /api/invoices/comments', () => {
  it('returns 401 without a bearer token', async () => {
    mockUser = null
    const res = await POST(makeRequest({ body: { invoiceId: 'inv-1', body: 'hello' } }))
    expect(res.status).toBe(401)
  })

  it('returns 400 with an empty body', async () => {
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', body: '   ' } }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the invoice is not owned by the user (RLS)', async () => {
    clientConfig = { invoice: null }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'nope', body: 'hello' } }))
    expect(res.status).toBe(404)
  })

  it('adds a comment and defaults the audience to team', async () => {
    const res = await POST(
      makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', body: 'A note', audience: 'bogus', parentId: 'c-1' } }),
    )
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.comment).toMatchObject({ id: 'c-2' })

    const inserted = currentClient.__state.inserts.find((i) => i.table === 'invoice_comments')
    expect(inserted.payload).toMatchObject({
      invoice_id: 'inv-1',
      user_id: 'user-1',
      parent_id: 'c-1',
      audience: 'team',
      body: 'A note',
    })
  })

  it('returns 500 when the insert fails', async () => {
    clientConfig = { comment: null, commentError: { message: 'boom' } }
    currentClient = makeSupabase()
    const res = await POST(makeRequest({ auth: 'Bearer t', body: { invoiceId: 'inv-1', body: 'hello' } }))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/invoices/comments', () => {
  it('returns 401 without a bearer token', async () => {
    mockUser = null
    const res = await DELETE(makeRequest({ url: 'http://localhost/api/invoices/comments?id=c-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 without an id', async () => {
    const res = await DELETE(makeRequest({ auth: 'Bearer t' }))
    expect(res.status).toBe(400)
  })

  it('deletes the comment and returns ok', async () => {
    const res = await DELETE(makeRequest({ auth: 'Bearer t', url: 'http://localhost/api/invoices/comments?id=c-1' }))
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(currentClient.__state.deletes.find((d) => d.table === 'invoice_comments')).toBeTruthy()
  })
})
