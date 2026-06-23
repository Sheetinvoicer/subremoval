import '@testing-library/jest-dom'

// jsdom does not provide TextEncoder/TextDecoder, which Node libraries pulled in
// by some API-route tests (resend -> postal-mime) require at import time.
// Polyfill them from Node's `util` so those suites can load.
const { TextEncoder, TextDecoder } = require('util')
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}))

// next-intl ships as ESM and is not transformed by next/jest, so any test that
// renders a component calling `useTranslations` previously failed to even parse.
// Mock it with a lightweight implementation that resolves the real English
// messages and interpolates simple `{param}` placeholders, so component tests
// can render without wiring up the full i18n provider.
jest.mock('next-intl', () => {
  const messages = require('./messages/en.json')

  const lookup = (path) =>
    path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), messages)

  const interpolate = (template, params) =>
    typeof template === 'string' && params
      ? template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match))
      : template

  const makeT = (namespace) => {
    const t = (key, params) => {
      const fullKey = namespace ? `${namespace}.${key}` : key
      const value = lookup(fullKey)
      return typeof value === 'string' ? interpolate(value, params) : fullKey
    }
    t.rich = (key, params) => t(key, params)
    t.raw = (key) => lookup(namespace ? `${namespace}.${key}` : key)
    t.has = (key) => lookup(namespace ? `${namespace}.${key}` : key) !== undefined
    return t
  }

  return {
    useTranslations: (namespace) => makeT(namespace),
    useLocale: () => 'en',
    useMessages: () => messages,
    useNow: () => new Date(),
    useTimeZone: () => 'UTC',
    useFormatter: () => ({
      number: (value) => String(value),
      dateTime: (value) => String(value),
      relativeTime: (value) => String(value),
      list: (value) => Array.from(value || []).join(', '),
    }),
    NextIntlClientProvider: ({ children }) => children,
    hasLocale: (locales, locale) => Array.from(locales || []).includes(locale),
  }
})

// next-intl/routing is a separate ESM entry used by i18n/routing.ts (which pages
// import). `defineRouting` just returns its config object, so mock it as identity.
jest.mock('next-intl/routing', () => ({
  defineRouting: (config) => config,
}))
