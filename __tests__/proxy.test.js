const nextMock = jest.fn(() => ({ type: 'next-response' }))
const redirectMock = jest.fn((url) => ({ type: 'redirect', url }))

jest.mock('../i18n/routing', () => ({
  routing: {
    locales: ['en', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ar'],
    defaultLocale: 'en',
    localePrefix: 'never',
  },
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: null } })),
    },
    from: jest.fn(),
  })),
}))

jest.mock('next/server', () => ({
  NextResponse: {
    next: (...args) => nextMock(...args),
    redirect: (url) => redirectMock(url),
    json: jest.fn(),
  },
}))

describe('proxy middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes through non-localized, non-protected paths via NextResponse.next()', async () => {
    const { default: middleware } = require('../proxy')

    const request = {
      nextUrl: {
        pathname: '/',
        search: '',
      },
      url: 'https://example.com/',
      cookies: {
        getAll: () => [],
      },
    }

    const response = await middleware(request)

    expect(nextMock).toHaveBeenCalledTimes(1)
    expect(redirectMock).not.toHaveBeenCalled()
    expect(response).toEqual({ type: 'next-response' })
  })

  it('redirects to strip a locale prefix when localePrefix is "never"', async () => {
    const { default: middleware } = require('../proxy')

    const request = {
      nextUrl: {
        pathname: '/es/dashboard',
        search: '',
      },
      url: 'https://example.com/es/dashboard',
      cookies: {
        getAll: () => [],
      },
    }

    const response = await middleware(request)

    expect(redirectMock).toHaveBeenCalledTimes(1)
    expect(nextMock).not.toHaveBeenCalled()
    expect(response).toEqual({ type: 'redirect', url: expect.anything() })
  })
})