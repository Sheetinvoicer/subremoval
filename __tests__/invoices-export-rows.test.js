const { buildLocalizedInvoiceExportRows, toCsv } = require('@/lib/accountingExport')
const { formatCurrencyAmount } = require('@/lib/currency')

const LABELS = {
  invoiceNumber: 'No.',
  client: 'Client',
  project: 'Project',
  status: 'Status',
  subtotal: 'Subtotal',
  tax: 'Tax',
  total: 'Total',
  currency: 'Currency',
  dueDate: 'Due',
  createdAt: 'Created',
  generatedAt: 'Generated at',
  filters: 'Filters',
  locale: 'Locale',
}

const INVOICES = [
  {
    id: 'a',
    invoice_number: '1001',
    client_name: 'Acme',
    project_name: 'Web',
    status: 'paid',
    currency: 'EUR',
    subtotal: 1000,
    tax_amount: 190,
    total: 1190,
    due_date: '2026-06-20',
    created_at: '2026-06-01',
  },
  {
    id: 'b',
    invoice_number: '1002',
    client_name: null,
    project_name: null,
    status: 'draft',
    currency: 'USD',
    subtotal: 50.5,
    tax_amount: 0,
    total: 50.5,
    due_date: null,
    created_at: '2026-05-15',
  },
]

function expectedDate(value, locale) {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

describe('buildLocalizedInvoiceExportRows', () => {
  it('prepends metadata + a localized header before the table (de)', () => {
    const meta = { generatedAt: '2026-06-25 10:00', filterSummary: 'status=paid', locale: 'de' }
    const rows = buildLocalizedInvoiceExportRows(INVOICES, { locale: 'de', labels: LABELS, meta })

    expect(rows[0]).toEqual(['Generated at', '2026-06-25 10:00'])
    expect(rows[1]).toEqual(['Filters', 'status=paid'])
    expect(rows[2]).toEqual(['Locale', 'de'])
    expect(rows[3]).toEqual([]) // blank separator
    expect(rows[4]).toEqual(['No.', 'Client', 'Project', 'Status', 'Subtotal', 'Tax', 'Total', 'Currency', 'Due', 'Created'])
  })

  it('formats money + dates for the de locale', () => {
    const meta = { generatedAt: 'x', filterSummary: 'y', locale: 'de' }
    const rows = buildLocalizedInvoiceExportRows(INVOICES, { locale: 'de', labels: LABELS, meta })
    const row = rows[5]

    expect(row[0]).toBe('1001')
    expect(row[1]).toBe('Acme')
    expect(row[2]).toBe('Web')
    expect(row[3]).toBe('paid')
    expect(row[4]).toBe(formatCurrencyAmount(1000, 'EUR', 'de'))
    expect(row[5]).toBe(formatCurrencyAmount(190, 'EUR', 'de'))
    expect(row[6]).toBe(formatCurrencyAmount(1190, 'EUR', 'de'))
    expect(row[7]).toBe('EUR')
    expect(row[8]).toBe(expectedDate('2026-06-20', 'de'))
    expect(row[9]).toBe(expectedDate('2026-06-01', 'de'))

    // Locale really matters: German formatting differs from English.
    expect(formatCurrencyAmount(1000, 'EUR', 'de')).not.toBe(formatCurrencyAmount(1000, 'EUR', 'en'))
  })

  it('formats money + dates for the ar locale', () => {
    const meta = { generatedAt: 'x', filterSummary: 'y', locale: 'ar' }
    const rows = buildLocalizedInvoiceExportRows(INVOICES, { locale: 'ar', labels: LABELS, meta })
    const row = rows[5]

    expect(row[6]).toBe(formatCurrencyAmount(1190, 'EUR', 'ar'))
    expect(row[8]).toBe(expectedDate('2026-06-20', 'ar'))
  })

  it('renders blanks for null client/project/dates', () => {
    const meta = { generatedAt: 'x', filterSummary: 'y', locale: 'de' }
    const rows = buildLocalizedInvoiceExportRows(INVOICES, { locale: 'de', labels: LABELS, meta })
    const row = rows[6]

    expect(row[0]).toBe('1002')
    expect(row[1]).toBe('') // null client_name
    expect(row[2]).toBe('') // null project_name
    expect(row[8]).toBe('') // null due_date
  })

  it('returns only metadata + header for an empty result set', () => {
    const meta = { generatedAt: 'x', filterSummary: 'no matches', locale: 'en' }
    const rows = buildLocalizedInvoiceExportRows([], { locale: 'en', labels: LABELS, meta })

    // 3 metadata rows + 1 blank + 1 header, no data rows.
    expect(rows).toHaveLength(5)
    expect(rows[4][0]).toBe('No.')
  })

  it('is deterministic and produces a BOM + CRLF CSV', () => {
    const meta = { generatedAt: 'x', filterSummary: 'y', locale: 'de' }
    const opts = { locale: 'de', labels: LABELS, meta }

    const first = buildLocalizedInvoiceExportRows(INVOICES, opts)
    const second = buildLocalizedInvoiceExportRows(INVOICES, opts)
    expect(first).toEqual(second)

    const csv = toCsv(first)
    expect(csv).toBe(toCsv(second))
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('\r\n')
    expect(csv).toContain('1001')
  })
})
