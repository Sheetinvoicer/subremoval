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
  return JSON.parse(raw).subscriptionPlans
}

describe('subscriptionPlans i18n parity', () => {
  it('defines the namespace for every supported locale', () => {
    for (const locale of LOCALES) {
      expect(loadNamespace(locale)).toBeTruthy()
    }
  })

  it('has an identical key set across all locales', () => {
    const reference = flattenKeys(loadNamespace('en'))
    expect(reference.length).toBeGreaterThan(30)

    for (const locale of LOCALES) {
      const keys = flattenKeys(loadNamespace(locale))
      expect({ locale, keys }).toEqual({ locale, keys: reference })
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
