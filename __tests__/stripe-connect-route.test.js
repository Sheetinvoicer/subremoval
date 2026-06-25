const authorizeUrlMock = jest.fn()
const tokenMock = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
      cookies: { set: jest.fn() },
    }),
    redirect: (url) => ({
      status: 307,
      url,
      headers: { get: (key) => (key.toLowerCase() === 'location' ? url : null) },
      cookies: { set: jest.fn() },
    }),
  },
}))

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    oauth: { authorizeUrl: authorizeUrlMock, token: tokenMock },
  }))
})

const { POST: connectPost } = require('@/app/api/stripe/connect/route')
const { GET: callbackGet } = require('@/app/api/stripe/connect/callback/route')

function makeConnectReq() {
  return { nextUrl: { origin: 'http://localhost:3000' } }
}

function makeCallbackReq({ search = '', cookies = {} } = {}) {
  return {
    nextUrl: {
      origin: 'http://localhost:3000',
      searchParams: new URLSearchParams(search),
    },
    cookies: {
      get: (name) => (name in cookies ? { value: cookies[name] } : undefined),
    },
  }
}

describe('Stripe Connect OAuth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_test_123'
  })

  it('returns 400 when the Connect client id is not configured', async () => {
    delete process.env.STRIPE_CONNECT_CLIENT_ID
    delete process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID

    const res = await connectPost(makeConnectReq())
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error).toMatch(/STRIPE_CONNECT_CLIENT_ID/)
  })

  it('returns 500 when the Stripe secret key is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY

    const res = await connectPost(makeConnectReq())
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error).toMatch(/STRIPE_SECRET_KEY/)
  })

  it('returns the Stripe Connect authorize URL when configured', async () => {
    authorizeUrlMock.mockReturnValue('https://connect.stripe.com/oauth/authorize?x=1')

    const res = await connectPost(makeConnectReq())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.url).toBe('https://connect.stripe.com/oauth/authorize?x=1')
    expect(authorizeUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'code',
        client_id: 'ca_test_123',
        scope: 'read_write',
        redirect_uri: 'http://localhost:3000/api/stripe/connect/callback',
        state: expect.any(String),
      }),
    )
  })

  it('callback exchanges the code and redirects to settings on success', async () => {
    tokenMock.mockResolvedValue({ stripe_user_id: 'acct_123' })

    const req = makeCallbackReq({
      search: 'code=auth_code&state=abc',
      cookies: { stripe_connect_state: 'abc' },
    })

    const res = await callbackGet(req)

    expect(tokenMock).toHaveBeenCalledWith({ grant_type: 'authorization_code', code: 'auth_code' })
    expect(res.headers.get('location')).toContain('/dashboard/settings?bank=connected')
  })

  it('callback redirects with an error when the state does not match', async () => {
    const req = makeCallbackReq({
      search: 'code=auth_code&state=forged',
      cookies: { stripe_connect_state: 'abc' },
    })

    const res = await callbackGet(req)

    expect(tokenMock).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toContain('/dashboard/settings?bank=error')
  })

  it('callback redirects with an error when token exchange yields no account', async () => {
    tokenMock.mockResolvedValue({})

    const req = makeCallbackReq({
      search: 'code=auth_code&state=abc',
      cookies: { stripe_connect_state: 'abc' },
    })

    const res = await callbackGet(req)

    expect(res.headers.get('location')).toContain('/dashboard/settings?bank=error')
  })
})
