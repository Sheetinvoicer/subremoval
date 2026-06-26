const fs = require('fs')
const path = require('path')

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ar']
const messagesDir = path.join(__dirname, '..', 'messages')

function load(locale) {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'))
}

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

function placeholdersFor(obj) {
  const map = {}
  const visit = (node, prefix = '') => {
    for (const [key, value] of Object.entries(node)) {
      const full = prefix ? `${prefix}.${key}` : key
      if (value && typeof value === 'object') visit(value, full)
      else {
        const found = (String(value).match(/\{(\w+)\}/g) || []).sort()
        if (found.length) map[full] = found
      }
    }
  }
  visit(obj)
  return map
}

// The new AI/enterprise dashboard subtrees + sidebar section labels added in the
// dashboard upgrade. Guards that every locale stays in lockstep.
const DASHBOARD_SUBTREES = ['ai', 'quickActions', 'activity', 'metrics', 'chat']

function dashboardSubset(locale) {
  const dash = load(locale).dashboard || {}
  const subset = {}
  for (const key of DASHBOARD_SUBTREES) subset[key] = dash[key]
  return subset
}

describe('dashboard AI/enterprise i18n parity', () => {
  it('defines every new dashboard subtree for all locales', () => {
    for (const locale of LOCALES) {
      const subset = dashboardSubset(locale)
      for (const key of DASHBOARD_SUBTREES) {
        expect({ locale, key, present: Boolean(subset[key]) }).toEqual({ locale, key, present: true })
      }
    }
  })

  it('keeps an identical dashboard key set across locales', () => {
    const reference = flattenKeys(dashboardSubset('en'))
    expect(reference.length).toBeGreaterThan(20)
    for (const locale of LOCALES) {
      expect({ locale, keys: flattenKeys(dashboardSubset(locale)) }).toEqual({ locale, keys: reference })
    }
  })

  it('keeps identical sidebar section labels across locales', () => {
    const reference = flattenKeys(load('en').sidebar.sections)
    expect(reference).toEqual(['account', 'administration', 'finance', 'overview', 'sales', 'workspace'])
    for (const locale of LOCALES) {
      expect({ locale, keys: flattenKeys(load(locale).sidebar.sections) }).toEqual({ locale, keys: reference })
    }
  })

  it('keeps ICU placeholders consistent with English', () => {
    const en = placeholdersFor(dashboardSubset('en'))
    for (const locale of LOCALES) {
      expect({ locale, ph: placeholdersFor(dashboardSubset(locale)) }).toEqual({ locale, ph: en })
    }
  })

  it('has no empty translation values in the new subtrees', () => {
    for (const locale of LOCALES) {
      const subset = { ...dashboardSubset(locale), sections: load(locale).sidebar.sections }
      const visit = (node) => {
        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') visit(value)
          else expect(String(value).trim().length).toBeGreaterThan(0)
        }
      }
      visit(subset)
    }
  })
})
