jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({ status: init.status || 200, json: async () => body }),
  },
}))

let currentSupabase = null
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => currentSupabase),
}))

const team = require('@/app/api/team/route')
const sso = require('@/app/api/sso/route')

// Flexible Supabase mock supporting select/eq/neq/order/insert/delete/maybeSingle.
function makeSupabase({
  user = { id: 'u1', email: 'u@example.com' },
  plan = 'Business',
  members = [],
  count = 0,
  insertRow = { id: 'm1' },
  connections = [],
  connectionRow = { id: 'c1' },
} = {}) {
  const auth = {
    getUser: jest.fn().mockResolvedValue({
      data: { user },
      error: user ? null : { message: 'no user' },
    }),
  }

  function from(table) {
    let head = false
    const builder = {
      select(_cols, opts) {
        if (opts && opts.head) head = true
        return builder
      },
      insert() {
        return builder
      },
      delete() {
        return builder
      },
      eq() {
        return builder
      },
      neq() {
        return builder
      },
      order() {
        return builder
      },
      maybeSingle() {
        if (table === 'subscriptions') return Promise.resolve({ data: { plan }, error: null })
        if (table === 'team_members') return Promise.resolve({ data: insertRow, error: null })
        if (table === 'sso_connections') return Promise.resolve({ data: connectionRow, error: null })
        return Promise.resolve({ data: null, error: null })
      },
      then(resolve) {
        if (head) return resolve({ count, data: null, error: null })
        if (table === 'team_members') return resolve({ data: members, error: null })
        if (table === 'sso_connections') return resolve({ data: connections, error: null })
        return resolve({ data: null, error: null })
      },
    }
    return builder
  }

  return { auth, from: jest.fn(from) }
}

const jsonReq = (body) => ({ json: async () => body, url: 'http://localhost/api' })
const urlReq = (url) => ({ url })

describe('team routes', () => {
  afterEach(() => {
    currentSupabase = null
  })

  it('requires auth on GET', async () => {
    currentSupabase = makeSupabase({ user: null })
    const res = await team.GET()
    expect(res.status).toBe(401)
  })

  it('lists members and seat usage for Business', async () => {
    currentSupabase = makeSupabase({ plan: 'Business', members: [{ id: 'm1' }] })
    const res = await team.GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.seats).toEqual({ used: 2, limit: 5, invitable: 4 })
    expect(body.members).toHaveLength(1)
  })

  it('invites a teammate when under the seat limit', async () => {
    currentSupabase = makeSupabase({ plan: 'Business', count: 0, insertRow: { id: 'm9', member_email: 'x@y.com' } })
    const res = await team.POST(jsonReq({ email: 'x@y.com' }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.member.id).toBe('m9')
  })

  it('blocks invites past the seat limit (Pro has 1 seat)', async () => {
    currentSupabase = makeSupabase({ plan: 'Pro', count: 0 })
    const res = await team.POST(jsonReq({ email: 'x@y.com' }))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('seat_limit')
  })

  it('rejects invalid emails', async () => {
    currentSupabase = makeSupabase({ plan: 'Business' })
    const res = await team.POST(jsonReq({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('removes a member by id', async () => {
    currentSupabase = makeSupabase({ plan: 'Business' })
    const res = await team.DELETE(urlReq('http://localhost/api/team?id=m1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('requires an id to delete', async () => {
    currentSupabase = makeSupabase({ plan: 'Business' })
    const res = await team.DELETE(urlReq('http://localhost/api/team'))
    expect(res.status).toBe(400)
  })
})

describe('sso routes', () => {
  afterEach(() => {
    currentSupabase = null
  })

  it('registers an SSO domain on Business', async () => {
    currentSupabase = makeSupabase({ plan: 'Business', connectionRow: { id: 'c1', domain: 'acme.com' } })
    const res = await sso.POST(jsonReq({ domain: 'acme.com' }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.connection.domain).toBe('acme.com')
  })

  it('locks SSO behind the plan feature (Pro)', async () => {
    currentSupabase = makeSupabase({ plan: 'Pro' })
    const res = await sso.POST(jsonReq({ domain: 'acme.com' }))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('feature_locked')
  })

  it('rejects invalid domains', async () => {
    currentSupabase = makeSupabase({ plan: 'Business' })
    const res = await sso.POST(jsonReq({ domain: 'not a domain' }))
    expect(res.status).toBe(400)
  })

  it('locks GET for Free plans', async () => {
    currentSupabase = makeSupabase({ plan: 'Free' })
    const res = await sso.GET()
    expect(res.status).toBe(403)
  })
})
