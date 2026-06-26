const fs = require('fs')
const path = require('path')

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ar']
const messagesDir = path.join(__dirname, '..', 'messages')

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, full))
    } else {
      keys.push(full)
    }
  }
  return keys.sort()
}

function loadNamespace(locale) {
  const raw = fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8')
  return JSON.parse(raw).invoices
}

// The keys the list page (app/dashboard/invoices/page.tsx) calls via
// useTranslations('invoices.list'). Guards the Step 1 localization gap so the
// list page can never reference a missing key in any locale again.
const REQUIRED_LIST_KEYS = [
  'search.label',
  'search.placeholder',
  'filters.status',
  'status.draft',
  'status.sent',
  'status.viewed',
  'status.paid',
  'status.overdue',
  'status.disputed',
  'status.cancelled',
  'results.total',
  'results.empty',
  'results.emptyHint',
  'results.noMatches',
  'results.noMatchesHint',
  'row.selectOne',
  'row.unknownClient',
  'row.noProject',
  'row.dueLabel',
  'errors.retry',
  'errors.supabaseInit',
  'errors.loginRequired',
  'errors.query',
].sort()

describe('invoices i18n parity', () => {
  it('defines the namespace for every supported locale', () => {
    for (const locale of LOCALES) {
      expect(loadNamespace(locale)).toBeTruthy()
    }
  })

  it('has an identical key set across all locales', () => {
    const reference = flattenKeys(loadNamespace('en'))
    expect(reference.length).toBeGreaterThan(100)

    for (const locale of LOCALES) {
      const keys = flattenKeys(loadNamespace(locale))
      expect({ locale, keys }).toEqual({ locale, keys: reference })
    }
  })

  it('provides every invoices.list key the list page renders', () => {
    for (const locale of LOCALES) {
      const list = loadNamespace(locale).list
      expect(list).toBeTruthy()
      const keys = flattenKeys(list)
      for (const required of REQUIRED_LIST_KEYS) {
        expect({ locale, required, present: keys.includes(required) }).toEqual({
          locale,
          required,
          present: true,
        })
      }
    }
  })

  it('has no empty translation values', () => {
    for (const locale of LOCALES) {
      const ns = loadNamespace(locale)
      const visit = (obj) => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') visit(value)
          else expect(String(value).trim().length).toBeGreaterThan(0)
        }
      }
      visit(ns)
    }
  })

  it('keeps ICU placeholders consistent with English', () => {
    const placeholdersFor = (ns) => {
      const map = {}
      const visit = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const full = prefix ? `${prefix}.${key}` : key
          if (value && typeof value === 'object') visit(value, full)
          else {
            const found = (String(value).match(/\{(\w+)\}/g) || []).sort()
            if (found.length) map[full] = found
          }
        }
      }
      visit(ns)
      return map
    }

    const en = placeholdersFor(loadNamespace('en'))
    for (const locale of LOCALES) {
      const other = placeholdersFor(loadNamespace(locale))
      expect({ locale, ph: other }).toEqual({ locale, ph: en })
    }
  })
})
