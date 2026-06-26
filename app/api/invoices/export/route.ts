import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import {
  buildInvoiceExportQuery,
  parseInvoiceParams,
  MAX_EXPORT_ROWS,
  type InvoiceQueryParams,
} from '@/lib/invoices/query'
import {
  buildLocalizedInvoiceExportRows,
  toCsv,
  type ExportInvoice,
  type LocalizedExportLabels,
} from '@/lib/accountingExport'
import { renderInvoiceListPdf } from '@/lib/invoices/pdf'

// @react-pdf/renderer requires the Node.js runtime (it cannot run on Edge), and
// the export reads request-specific data, so the route is always dynamic.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ExportFormat = 'csv' | 'pdf'

interface ExportRequestBody {
  params?: Record<string, string>
  format?: string
  locale?: string
  title?: string
  filterSummary?: string
  labels?: Partial<LocalizedExportLabels>
}

// English fallbacks so the route still produces a usable file if the client
// omits localized labels; the list page always sends a full localized set.
const DEFAULT_LABELS: LocalizedExportLabels = {
  invoiceNumber: 'Invoice number',
  client: 'Client',
  project: 'Project',
  status: 'Status',
  subtotal: 'Subtotal',
  tax: 'Tax',
  total: 'Total',
  currency: 'Currency',
  dueDate: 'Due date',
  createdAt: 'Created',
  generatedAt: 'Generated at',
  filters: 'Filters',
  locale: 'Locale',
}

function sanitizeFormat(format?: string): ExportFormat {
  return format === 'pdf' ? 'pdf' : 'csv'
}

function paramsFromBody(raw: ExportRequestBody['params']): InvoiceQueryParams {
  const search = new URLSearchParams()
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      if (value != null) search.set(key, String(value))
    }
  }
  return parseInvoiceParams(search)
}

// Deterministic, machine-readable summary of the active filters embedded in the
// export metadata when the client does not provide its own localized summary.
function summarizeParams(p: InvoiceQueryParams): string {
  const parts: string[] = []
  if (p.status?.length) parts.push(`status=${p.status.join('|')}`)
  if (p.search) parts.push(`search=${p.search}`)
  if (p.clientId) parts.push(`client=${p.clientId}`)
  if (p.projectId) parts.push(`project=${p.projectId}`)
  if (p.from) parts.push(`from=${p.from}`)
  if (p.to) parts.push(`to=${p.to}`)
  if (p.minAmount != null) parts.push(`min=${p.minAmount}`)
  if (p.maxAmount != null) parts.push(`max=${p.maxAmount}`)
  if (p.tags?.length) parts.push(`tags=${p.tags.join('|')}`)
  if (p.metaKey && p.metaValue) parts.push(`${p.metaKey}=${p.metaValue}`)
  return parts.length ? parts.join('; ') : 'all'
}

export async function POST(request: Request) {
  try {
    // Bearer-auth + token-scoped client so the export query runs under the
    // user's RLS policies (mirrors app/api/accounting/export/route.ts).
    const authHeader =
      request.headers.get('authorization') || request.headers.get('Authorization')
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    const supabase = await createClient(accessToken)

    const {
      data: { user },
      error: userError,
    } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as ExportRequestBody
    const format = sanitizeFormat(body.format)
    const locale = typeof body.locale === 'string' && body.locale ? body.locale : 'en'
    const params = paramsFromBody(body.params)
    const labels: LocalizedExportLabels = { ...DEFAULT_LABELS, ...(body.labels || {}) }

    return await Sentry.startSpan(
      { name: 'invoices.export', op: 'http.server', attributes: { format, locale } },
      async () => {
        const { rows } = buildInvoiceExportQuery(supabase, user.id, params)
        const { data, error } = await (rows as any)

        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const fetched = (data ?? []) as ExportInvoice[]
        // The query fetched MAX_EXPORT_ROWS + 1; more than the cap means the
        // filter set is too large to export safely — tell the client instead of
        // returning a silently truncated file.
        if (fetched.length > MAX_EXPORT_ROWS) {
          return NextResponse.json(
            { error: 'Export exceeds the maximum row count', code: 'EXPORT_TOO_LARGE', max: MAX_EXPORT_ROWS },
            { status: 413 },
          )
        }

        const invoices = fetched
        const generatedAt = new Date().toISOString()
        const filterSummary =
          typeof body.filterSummary === 'string' && body.filterSummary
            ? body.filterSummary
            : summarizeParams(params)
        const timestamp = generatedAt.slice(0, 10)

        if (format === 'pdf') {
          const title = typeof body.title === 'string' && body.title ? body.title : 'Invoices'
          const buffer = await renderInvoiceListPdf({
            invoices,
            locale,
            title,
            labels,
            meta: { generatedAt, filterSummary },
          })
          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="invoices-${timestamp}.pdf"`,
            },
          })
        }

        const csv = toCsv(
          buildLocalizedInvoiceExportRows(invoices, {
            locale,
            labels,
            meta: { generatedAt, filterSummary, locale },
          }),
        )
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="invoices-${timestamp}.csv"`,
          },
        })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to export invoices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
