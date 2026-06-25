// Lightweight, offline tax-rates "database" keyed by ISO 3166-1 alpha-2
// country code. Rates are the standard national VAT/GST/Sales-Tax rates and
// are used as smart defaults when creating invoices. They can always be
// overridden manually by the user, so approximate values are acceptable.
//
// `type` is the human-readable label of the tax regime (VAT, GST, Sales Tax,
// Consumption Tax, ...). `rate` is expressed as a percentage (e.g. 20 = 20%).

export const TAX_RATES = {
  // North America
  US: { type: 'Sales Tax', rate: 0, name: 'Sales Tax' },
  CA: { type: 'GST', rate: 5, name: 'Goods and Services Tax' },
  MX: { type: 'VAT', rate: 16, name: 'Impuesto al Valor Agregado' },

  // United Kingdom & Ireland
  GB: { type: 'VAT', rate: 20, name: 'Value Added Tax' },
  IE: { type: 'VAT', rate: 23, name: 'Value Added Tax' },

  // Eurozone / EU
  DE: { type: 'VAT', rate: 19, name: 'Mehrwertsteuer' },
  FR: { type: 'VAT', rate: 20, name: 'Taxe sur la valeur ajoutée' },
  ES: { type: 'VAT', rate: 21, name: 'Impuesto sobre el Valor Añadido' },
  IT: { type: 'VAT', rate: 22, name: "Imposta sul valore aggiunto" },
  NL: { type: 'VAT', rate: 21, name: 'Belasting toegevoegde waarde' },
  BE: { type: 'VAT', rate: 21, name: 'Value Added Tax' },
  AT: { type: 'VAT', rate: 20, name: 'Umsatzsteuer' },
  PT: { type: 'VAT', rate: 23, name: 'Imposto sobre o Valor Acrescentado' },
  GR: { type: 'VAT', rate: 24, name: 'Value Added Tax' },
  FI: { type: 'VAT', rate: 25.5, name: 'Arvonlisävero' },
  SE: { type: 'VAT', rate: 25, name: 'Mervärdesskatt' },
  DK: { type: 'VAT', rate: 25, name: 'Merværdiafgift' },
  PL: { type: 'VAT', rate: 23, name: 'Podatek od towarów i usług' },
  CZ: { type: 'VAT', rate: 21, name: 'Value Added Tax' },
  RO: { type: 'VAT', rate: 19, name: 'Value Added Tax' },
  HU: { type: 'VAT', rate: 27, name: 'Általános forgalmi adó' },
  LU: { type: 'VAT', rate: 17, name: 'Value Added Tax' },

  // Rest of Europe
  NO: { type: 'VAT', rate: 25, name: 'Merverdiavgift' },
  CH: { type: 'VAT', rate: 8.1, name: 'Mehrwertsteuer' },
  TR: { type: 'VAT', rate: 20, name: 'Katma Değer Vergisi' },
  RU: { type: 'VAT', rate: 20, name: 'Value Added Tax' },
  UA: { type: 'VAT', rate: 20, name: 'Value Added Tax' },

  // Middle East
  AE: { type: 'VAT', rate: 5, name: 'Value Added Tax' },
  SA: { type: 'VAT', rate: 15, name: 'Value Added Tax' },
  QA: { type: 'VAT', rate: 0, name: 'Value Added Tax' },
  KW: { type: 'VAT', rate: 0, name: 'Value Added Tax' },
  IL: { type: 'VAT', rate: 17, name: 'Value Added Tax' },

  // Asia Pacific
  AU: { type: 'GST', rate: 10, name: 'Goods and Services Tax' },
  NZ: { type: 'GST', rate: 15, name: 'Goods and Services Tax' },
  JP: { type: 'Consumption Tax', rate: 10, name: 'Consumption Tax' },
  CN: { type: 'VAT', rate: 13, name: 'Value Added Tax' },
  IN: { type: 'GST', rate: 18, name: 'Goods and Services Tax' },
  SG: { type: 'GST', rate: 9, name: 'Goods and Services Tax' },
  MY: { type: 'SST', rate: 8, name: 'Sales and Service Tax' },
  ID: { type: 'VAT', rate: 11, name: 'Pajak Pertambahan Nilai' },
  PH: { type: 'VAT', rate: 12, name: 'Value Added Tax' },
  TH: { type: 'VAT', rate: 7, name: 'Value Added Tax' },
  KR: { type: 'VAT', rate: 10, name: 'Value Added Tax' },
  HK: { type: 'Sales Tax', rate: 0, name: 'No general sales tax' },

  // Latin America
  BR: { type: 'Tax', rate: 17, name: 'ICMS (varies by state)' },
  AR: { type: 'VAT', rate: 21, name: 'Impuesto al Valor Agregado' },
  CL: { type: 'VAT', rate: 19, name: 'Impuesto al Valor Agregado' },
  CO: { type: 'VAT', rate: 19, name: 'Impuesto al Valor Agregado' },

  // Africa
  ZA: { type: 'VAT', rate: 15, name: 'Value Added Tax' },
  NG: { type: 'VAT', rate: 7.5, name: 'Value Added Tax' },
  EG: { type: 'VAT', rate: 14, name: 'Value Added Tax' },
  KE: { type: 'VAT', rate: 16, name: 'Value Added Tax' },
}

// Returned when a country is unknown or has no configured tax.
export const DEFAULT_TAX = { type: 'Tax', rate: 0, name: 'Tax' }

function normalizeCountryCode(countryCode) {
  return typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : ''
}

/**
 * Returns the full tax descriptor ({ type, rate, name }) for a country code.
 * Falls back to a zero-rated generic "Tax" when the country is unknown.
 */
export function getTaxInfo(countryCode) {
  const code = normalizeCountryCode(countryCode)
  return TAX_RATES[code] || DEFAULT_TAX
}

/**
 * Returns the standard tax percentage for a country (0 when unknown).
 */
export function getTaxRate(countryCode) {
  return getTaxInfo(countryCode).rate
}

/**
 * Returns the short label of the tax regime (e.g. "VAT", "GST", "Sales Tax").
 */
export function getTaxLabel(countryCode) {
  return getTaxInfo(countryCode).type
}

/**
 * True when we have an explicit tax configuration for the given country.
 */
export function hasTaxInfo(countryCode) {
  const code = normalizeCountryCode(countryCode)
  return Boolean(code && TAX_RATES[code])
}
