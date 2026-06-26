import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Single source of truth for the enterprise invoice list + export queries.
 *
 * The list page (and the export route) translate URL search params into an
 * {@link InvoiceQueryParams} object and feed it to {@link buildInvoiceQuery},
 * which pushes filtering, sorting and pagination down into Postgres via
 * PostgREST (`.eq/.in/.gte/.lte/.contains/.ilike/.order/.range`) instead of
 * loading every row and filtering in memory. The same builder is reused on the
 * server so exports honour the exact filters the user is looking at.
 */

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'disputed',
  'cancelled',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_SORT_FIELDS = [
  'created',
  'due',
  'amount',
  'status',
  'client',
  'project',
  'updated',
] as const

export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number]

export type SortDirection = 'asc' | 'desc'

export const DEFAULT_SORT: InvoiceSortField = 'created'
export const DEFAULT_DIRECTION: SortDirection = 'desc'
export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/** Columns selected for the list view. `client_name`/`project_name` are the
 *  denormalized columns that make server-side sort/search by client/project
 *  possible (PostgREST cannot `.order()` or OR-search across embedded
 *  relations). */
export const INVOICE_LIST_COLUMNS =
  'id, invoice_number, total, currency, status, due_date, created_at, updated_at, client_id, project_id, client_name, project_name, tags'

/** Richer column set for exports (adds subtotal/tax/notes for the CSV + PDF). */
export const INVOICE_EXPORT_COLUMNS =
  'id, invoice_number, client_name, project_name, status, currency, subtotal, tax_amount, total, due_date, created_at, notes, tags'

/** Hard cap on rows returned by a single export so a huge filter set can't
 *  exhaust the serverless function's memory or produce an unbounded download. */
export const MAX_EXPORT_ROWS = 5000

/** Plain-text columns that the debounced search box matches against. */
export const INVOICE_SEARCH_COLUMNS = ['invoice_number', 'client_name', 'project_name', 'notes'] as const

const SORT_COLUMN: Record<InvoiceSortField, string> = {
  created: 'created_at',
  due: 'due_date',
  amount: 'total',
  status: 'status',
  client: 'client_name',
  project: 'project_name',
  updated: 'updated_at',
}

export interface InvoiceQueryParams {
  status?: string[]
  from?: string
  to?: string
  clientId?: string
  projectId?: string
  minAmount?: number
  maxAmount?: number
  tags?: string[]
  /** Single custom-metadata key/value facet (`metadata @> { [key]: value }`). */
  metaKey?: string
  metaValue?: string
  search?: string
  sort?: InvoiceSortField
  dir?: SortDirection
  page?: number
  pageSize?: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function startOfDay(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value
}

function endOfDay(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T23:59:59.999Z` : value
}

/**
 * Strips characters that would break the PostgREST `or=(...)` grammar or inject
 * wildcards, so the search term can be safely interpolated into an `ilike`
 * filter. Returns an empty string when nothing searchable remains.
 */
export function sanitizeSearch(term: string | undefined | null): string {
  if (!term) return ''
  return term.replace(/[,()*:."\\%]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Builds the comma-separated PostgREST `or` expression matching the term across
 * the invoice number, denormalized client/project names, notes and the
 * line-item JSON (cast to text). Exposed for unit testing.
 */
export function buildSearchOr(term: string): string {
  const pattern = `*${term}*`
  const parts = INVOICE_SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`)
  parts.push(`items::text.ilike.${pattern}`)
  return parts.join(',')
}

export function clampPage(page: number | undefined): number {
  if (!isFiniteNumber(page) || page < 1) return 1
  return Math.floor(page)
}

export function clampPageSize(pageSize: number | undefined): number {
  if (!isFiniteNumber(pageSize)) return DEFAULT_PAGE_SIZE
  const allowed = PAGE_SIZE_OPTIONS as readonly number[]
  return allowed.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE
}

/**
 * Applies every filter (status, date range, client/project, amount range, tags,
 * metadata and full-text search) to a PostgREST query builder. Shared by the
 * rows query and the head-only count query so both stay perfectly in sync.
 */
function applyFilters<T>(query: T, userId: string, p: InvoiceQueryParams): T {
  // The builder mutates+returns itself; `any` avoids importing the full
  // PostgrestFilterBuilder generics (eslint allows `any` in this project).
  let q = query as any
  q = q.eq('user_id', userId)

  if (p.status && p.status.length > 0) q = q.in('status', p.status)
  if (p.clientId) q = q.eq('client_id', p.clientId)
  if (p.projectId) q = q.eq('project_id', p.projectId)
  if (p.from) q = q.gte('created_at', startOfDay(p.from))
  if (p.to) q = q.lte('created_at', endOfDay(p.to))
  if (isFiniteNumber(p.minAmount)) q = q.gte('total', p.minAmount)
  if (isFiniteNumber(p.maxAmount)) q = q.lte('total', p.maxAmount)
  if (p.tags && p.tags.length > 0) q = q.contains('tags', p.tags)
  if (p.metaKey && p.metaValue) q = q.contains('metadata', { [p.metaKey]: p.metaValue })

  const term = sanitizeSearch(p.search)
  if (term) q = q.or(buildSearchOr(term))

  return q as T
}

export interface BuiltInvoiceQuery {
  /** Ordered + range-limited rows query (resolve for `{ data }`). */
  rows: any
  /** Head-only `count: 'exact'` query for accessible pagination. */
  count: any
  /** Normalized paging echoed back so the caller can compute total pages. */
  page: number
  pageSize: number
}

/**
 * Produces the rows + count queries for a given set of params. Accepts either
 * the browser or the server Supabase client so the list page and the export
 * route share one implementation.
 */
export function buildInvoiceQuery(
  supabase: SupabaseClient,
  userId: string,
  p: InvoiceQueryParams,
): BuiltInvoiceQuery {
  const sort = p.sort && INVOICE_SORT_FIELDS.includes(p.sort) ? p.sort : DEFAULT_SORT
  const dir: SortDirection = p.dir === 'asc' ? 'asc' : 'desc'
  const ascending = dir === 'asc'
  const page = clampPage(p.page)
  const pageSize = clampPageSize(p.pageSize)
  const fromIndex = (page - 1) * pageSize

  let rows = applyFilters(supabase.from('invoices').select(INVOICE_LIST_COLUMNS), userId, p)
  rows = rows
    .order(SORT_COLUMN[sort], { ascending, nullsFirst: false })
    // Stable secondary key keeps pagination deterministic across equal values.
    .order('id', { ascending: true })
    .range(fromIndex, fromIndex + pageSize - 1)

  const count = applyFilters(
    supabase.from('invoices').select('id', { count: 'exact', head: true }),
    userId,
    p,
  )

  return { rows, count, page, pageSize }
}

/**
 * Like {@link buildInvoiceQuery} but for exports: reuses the exact same filter
 * + sort logic so an export honours the active filters, yet omits pagination
 * (`.range()`) and instead caps the result at {@link MAX_EXPORT_ROWS}. Selects
 * the richer {@link INVOICE_EXPORT_COLUMNS} set needed by the CSV/PDF builders.
 */
export function buildInvoiceExportQuery(
  supabase: SupabaseClient,
  userId: string,
  p: InvoiceQueryParams,
): { rows: any } {
  const sort = p.sort && INVOICE_SORT_FIELDS.includes(p.sort) ? p.sort : DEFAULT_SORT
  const dir: SortDirection = p.dir === 'asc' ? 'asc' : 'desc'
  const ascending = dir === 'asc'

  let rows = applyFilters(supabase.from('invoices').select(INVOICE_EXPORT_COLUMNS), userId, p)
  rows = rows
    .order(SORT_COLUMN[sort], { ascending, nullsFirst: false })
    // Stable secondary key keeps ordering deterministic across equal values.
    .order('id', { ascending: true })
    // Fetch one extra row past the cap: the caller can then detect an
    // over-limit result (length > MAX_EXPORT_ROWS) and surface a clear message
    // instead of silently returning a truncated export.
    .limit(MAX_EXPORT_ROWS + 1)

  return { rows }
}

// ---------------------------------------------------------------------------
// URL <-> params serialization (keeps list state shareable + back-button safe)
// ---------------------------------------------------------------------------

function splitList(value: string | null): string[] | undefined {
  if (!value) return undefined
  const parts = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : undefined
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseInvoiceParams(sp: URLSearchParams): InvoiceQueryParams {
  const statusRaw = splitList(sp.get('status'))
  const status = statusRaw?.filter((value): value is InvoiceStatus =>
    (INVOICE_STATUSES as readonly string[]).includes(value),
  )

  const sortRaw = sp.get('sort')
  const sort = sortRaw && (INVOICE_SORT_FIELDS as readonly string[]).includes(sortRaw)
    ? (sortRaw as InvoiceSortField)
    : undefined

  const dirRaw = sp.get('dir')
  const dir: SortDirection | undefined = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : undefined

  const params: InvoiceQueryParams = {
    status: status && status.length > 0 ? status : undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    clientId: sp.get('client') || undefined,
    projectId: sp.get('project') || undefined,
    minAmount: parseNumber(sp.get('min')),
    maxAmount: parseNumber(sp.get('max')),
    tags: splitList(sp.get('tags')),
    metaKey: sp.get('mk') || undefined,
    metaValue: sp.get('mv') || undefined,
    search: sp.get('q') || undefined,
    sort,
    dir,
    page: parseNumber(sp.get('page')),
    pageSize: parseNumber(sp.get('size')),
  }

  // Drop undefined keys so round-tripping yields a clean, comparable object.
  ;(Object.keys(params) as (keyof InvoiceQueryParams)[]).forEach((key) => {
    if (params[key] === undefined) delete params[key]
  })

  return params
}

export function serializeInvoiceParams(p: InvoiceQueryParams): URLSearchParams {
  const sp = new URLSearchParams()

  if (p.status && p.status.length > 0) sp.set('status', p.status.join(','))
  if (p.from) sp.set('from', p.from)
  if (p.to) sp.set('to', p.to)
  if (p.clientId) sp.set('client', p.clientId)
  if (p.projectId) sp.set('project', p.projectId)
  if (isFiniteNumber(p.minAmount)) sp.set('min', String(p.minAmount))
  if (isFiniteNumber(p.maxAmount)) sp.set('max', String(p.maxAmount))
  if (p.tags && p.tags.length > 0) sp.set('tags', p.tags.join(','))
  if (p.metaKey) sp.set('mk', p.metaKey)
  if (p.metaValue) sp.set('mv', p.metaValue)
  if (p.search) sp.set('q', p.search)
  if (p.sort) sp.set('sort', p.sort)
  if (p.dir) sp.set('dir', p.dir)
  if (isFiniteNumber(p.page) && p.page > 1) sp.set('page', String(p.page))
  if (isFiniteNumber(p.pageSize)) sp.set('size', String(p.pageSize))

  return sp
}
