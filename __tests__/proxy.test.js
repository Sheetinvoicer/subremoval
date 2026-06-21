const i18nHandlerMock = jest.fn(() => ({ type: 'i18n-response' }))
const redirectMock = jest.fn((url) => ({ type: 'redirect', url }))

jest.mock('next-intl/middleware', () => ({
  __esModule: true,
  default: jest.fn(() => i18nHandlerMock),
}))

jest.mock('../i18n/routing', () => ({
  routing: {
    locales: ['en', 'es'],
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
    redirect: (...args) => redirectMock(...args),
    json: jest.fn(),
  },
}))

describe('proxy middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns i18n routing for root path before locale redirect logic', async () => {
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

    expect(i18nHandlerMock).toHaveBeenCalledTimes(1)
    expect(i18nHandlerMock).toHaveBeenCalledWith(request)
    expect(redirectMock).not.toHaveBeenCalled()
    expect(response).toEqual({ type: 'i18n-response' })
  })
})