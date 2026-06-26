const {
  buildInvoiceQuery,
  parseInvoiceParams,
  serializeInvoiceParams,
  sanitizeSearch,
  buildSearchOr,
  clampPageSize,
  clampPage,
  DEFAULT_PAGE_SIZE,
  INVOICE_LIST_COLUMNS,
  INVOICE_EXPORT_COLUMNS,
  INVOICE_SEARCH_COLUMNS,
  MAX_EXPORT_ROWS,
  buildInvoiceExportQuery,
} = require('@/lib/invoices/query')

// A chainable stub that records every PostgREST builder call so we can assert
// exactly which filters/order/range were pushed down to the database.
function createBuilder() {
  const builder = { __calls: [] }
  const methods = ['select', 'eq', 'in', 'gte', 'lte', 'contains', 'or', 'order', 'range', 'limit']
  for (const method of methods) {
    builder[method] = (...args) => {
      builder.__calls.push([method, ...args])
      return builder
    }
  }
  return builder
}

function createSupabase() {
  const builders = []
  return {
    __builders: builders,
    from: (table) => {
      const builder = createBuilder()
      builder.__table = table
      builders.push(builder)
      return builder
    },
  }
}

const find = (builder, method) => builder.__calls.find((call) => call[0] === method)
const findAll = (builder, method) => builder.__calls.filter((call) => call[0] === method)

describe('buildInvoiceQuery', () => {
  it('pushes every filter, sort and range into the rows query', () => {
    const supabase = createSupabase()
    const params = {
      status: ['draft', 'sent'],
      from: '2026-01-01',
      to: '2026-02-01',
      clientId: 'client-1',
      projectId: 'project-1',
      minAmount: 100,
      maxAmount: 500,
      tags: ['urgent', 'vip'],
      metaKey: 'region',
      metaValue: 'eu',
      search: 'acme',
      sort: 'amount',
      dir: 'asc',
      page: 2,
      pageSize: 25,
    }

    const result = buildInvoiceQuery(supabase, 'user-1', params)

    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(25)
    expect(supabase.__builders).toHaveLength(2)

    const rows = supabase.__builders[0]
    expect(rows.__table).toBe('invoices')
    expect(find(rows, 'select')).toEqual(['select', INVOICE_LIST_COLUMNS])
    expect(find(rows, 'eq')).toEqual(['eq', 'user_id', 'user-1'])
    expect(find(rows, 'in')).toEqual(['in', 'status', ['draft', 'sent']])
    expect(rows.__calls).toContainEqual(['eq', 'client_id', 'client-1'])
    expect(rows.__calls).toContainEqual(['eq', 'project_id', 'project-1'])
    expect(rows.__calls).toContainEqual(['gte', 'created_at', '2026-01-01T00:00:00.000Z'])
    expect(rows.__calls).toContainEqual(['lte', 'created_at', '2026-02-01T23:59:59.999Z'])
    expect(rows.__calls).toContainEqual(['gte', 'total', 100])
    expect(rows.__calls).toContainEqual(['lte', 'total', 500])
    expect(rows.__calls).toContainEqual(['contains', 'tags', ['urgent', 'vip']])
    expect(rows.__calls).toContainEqual(['contains', 'metadata', { region: 'eu' }])
    expect(rows.__calls).toContainEqual(['or', buildSearchOr('acme')])

    const orders = findAll(rows, 'order')
    expect(orders[0]).toEqual(['order', 'total', { ascending: true, nullsFirst: false }])
    expect(orders[1]).toEqual(['order', 'id', { ascending: true }])

    // page 2, size 25 -> rows [25, 49]
    expect(find(rows, 'range')).toEqual(['range', 25, 49])
  })

  it('builds a head-only exact count query with the same filters but no order/range', () => {
    const supabase = createSupabase()
    buildInvoiceQuery(supabase, 'user-1', { status: ['paid'], search: 'acme' })

    const count = supabase.__builders[1]
    expect(find(count, 'select')).toEqual(['select', 'id', { count: 'exact', head: true }])
    expect(count.__calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(count.__calls).toContainEqual(['in', 'status', ['paid']])
    expect(count.__calls).toContainEqual(['or', buildSearchOr('acme')])
    expect(find(count, 'order')).toBeUndefined()
    expect(find(count, 'range')).toBeUndefined()
  })

  it('applies sensible defaults for empty params', () => {
    const supabase = createSupabase()
    const result = buildInvoiceQuery(supabase, 'user-1', {})

    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE)

    const rows = supabase.__builders[0]
    // Only the owner scope is applied (no status/client/etc).
    expect(findAll(rows, 'eq')).toEqual([['eq', 'user_id', 'user-1']])
    expect(find(rows, 'in')).toBeUndefined()
    expect(find(rows, 'or')).toBeUndefined()

    const orders = findAll(rows, 'order')
    expect(orders[0]).toEqual(['order', 'created_at', { ascending: false, nullsFirst: false }])
    expect(find(rows, 'range')).toEqual(['range', 0, DEFAULT_PAGE_SIZE - 1])
  })

  it('ignores an empty/whitespace search instead of emitting an `or`', () => {
    const supabase = createSupabase()
    buildInvoiceQuery(supabase, 'user-1', { search: '   ' })
    expect(find(supabase.__builders[0], 'or')).toBeUndefined()
  })
})

describe('search helpers', () => {
  it('sanitizeSearch strips characters that break the PostgREST or-grammar', () => {
    expect(sanitizeSearch('a,b(c):d*e."f"\\g%')).toBe('a b c d e f g')
    expect(sanitizeSearch('  spaced   out  ')).toBe('spaced out')
    expect(sanitizeSearch('')).toBe('')
    expect(sanitizeSearch(null)).toBe('')
  })

  it('buildSearchOr covers number, client, project, notes and line items', () => {
    const or = buildSearchOr('acme')
    for (const column of INVOICE_SEARCH_COLUMNS) {
      expect(or).toContain(`${column}.ilike.*acme*`)
    }
    expect(or).toContain('items::text.ilike.*acme*')
  })
})

describe('page-size / page clamping', () => {
  it('falls back to the default for invalid page sizes', () => {
    expect(clampPageSize(25)).toBe(25)
    expect(clampPageSize(7)).toBe(DEFAULT_PAGE_SIZE)
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE)
  })

  it('clamps the page to a positive integer', () => {
    expect(clampPage(3)).toBe(3)
    expect(clampPage(0)).toBe(1)
    expect(clampPage(-5)).toBe(1)
    expect(clampPage(undefined)).toBe(1)
  })
})

describe('URL param parse/serialize round-trip', () => {
  it('round-trips a fully populated params object', () => {
    const original = {
      status: ['draft', 'paid'],
      from: '2026-01-01',
      to: '2026-03-31',
      clientId: 'c1',
      projectId: 'p1',
      minAmount: 10,
      maxAmount: 9999,
      tags: ['a', 'b'],
      metaKey: 'k',
      metaValue: 'v',
      search: 'hello world',
      sort: 'due',
      dir: 'asc',
      page: 3,
      pageSize: 50,
    }

    const parsed = parseInvoiceParams(serializeInvoiceParams(original))
    expect(parsed).toEqual(original)
  })

  it('drops unknown statuses and invalid sort/dir on parse', () => {
    const sp = new URLSearchParams('status=draft,bogus&sort=nope&dir=sideways')
    const parsed = parseInvoiceParams(sp)
    expect(parsed.status).toEqual(['draft'])
    expect(parsed.sort).toBeUndefined()
    expect(parsed.dir).toBeUndefined()
  })

  it('omits default page (1) from the serialized query string', () => {
    const sp = serializeInvoiceParams({ page: 1, sort: 'amount' })
    expect(sp.has('page')).toBe(false)
    expect(sp.get('sort')).toBe('amount')
  })

  it('produces an empty params object for an empty query string', () => {
    expect(parseInvoiceParams(new URLSearchParams(''))).toEqual({})
  })
})

describe('buildInvoiceExportQuery', () => {
  it('reuses the filters/sort but caps rows and omits pagination range', () => {
    const supabase = createSupabase()
    const params = {
      status: ['draft', 'sent'],
      clientId: 'client-1',
      minAmount: 100,
      search: 'acme',
      sort: 'amount',
      dir: 'asc',
      page: 2,
      pageSize: 25,
    }

    const result = buildInvoiceExportQuery(supabase, 'user-1', params)

    // No separate count query — exports only need the rows.
    expect(supabase.__builders).toHaveLength(1)
    const rows = supabase.__builders[0]
    expect(rows.__table).toBe('invoices')
    expect(find(rows, 'select')).toEqual(['select', INVOICE_EXPORT_COLUMNS])
    expect(find(rows, 'eq')).toEqual(['eq', 'user_id', 'user-1'])
    expect(rows.__calls).toContainEqual(['in', 'status', ['draft', 'sent']])
    expect(rows.__calls).toContainEqual(['eq', 'client_id', 'client-1'])
    expect(rows.__calls).toContainEqual(['gte', 'total', 100])
    expect(rows.__calls).toContainEqual(['or', buildSearchOr('acme')])

    const orders = findAll(rows, 'order')
    expect(orders[0]).toEqual(['order', 'total', { ascending: true, nullsFirst: false }])
    expect(orders[1]).toEqual(['order', 'id', { ascending: true }])

    // Pagination is intentionally dropped; the row count is capped instead
    // (one extra row past the cap so an over-limit result is detectable).
    expect(find(rows, 'range')).toBeUndefined()
    expect(find(rows, 'limit')).toEqual(['limit', MAX_EXPORT_ROWS + 1])
    expect(result.rows).toBe(rows)
  })

  it('defaults to created-desc ordering and still caps rows for empty params', () => {
    const supabase = createSupabase()
    buildInvoiceExportQuery(supabase, 'user-1', {})

    const rows = supabase.__builders[0]
    const orders = findAll(rows, 'order')
    expect(orders[0]).toEqual(['order', 'created_at', { ascending: false, nullsFirst: false }])
    expect(find(rows, 'limit')).toEqual(['limit', MAX_EXPORT_ROWS + 1])
    expect(find(rows, 'range')).toBeUndefined()
  })
})
