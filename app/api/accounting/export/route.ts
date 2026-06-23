import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildInvoiceExportRows,
  buildQuickBooksRows,
  buildXeroRows,
  toCsv,
  toExcelHtml,
  type AccountingInvoice,
  type AccountingMapping,
} from '@/lib/accountingExport'

export const dynamic = 'force-dynamic'

type ExportFormat = 'quickbooks' | 'xero' | 'csv' | 'excel'

interface ExportRequestBody {
  format?: ExportFormat
  mapping?: Partial<AccountingMapping>
}

function sanitizeFormat(format?: string): ExportFormat {
  if (format === 'quickbooks' || format === 'xero' || format === 'csv' || format === 'excel') {
    return format
  }
  return 'csv'
}

export async function POST(request: Request) {
  try {
    // The server Supabase client is created with the anon key and does not
    // read auth cookies, so we authenticate the request via the bearer token
    // the browser sends from its active session. The token is also attached to
    // the client so the subsequent invoice query runs as the authenticated
    // user under RLS rather than the anonymous role.
    const authHeader =
      request.headers.get('authorization') || request.headers.get('Authorization')
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    const supabase = createClient(accessToken)

    const {
      data: { user },
      error: userError,
    } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as ExportRequestBody
    const format = sanitizeFormat(body.format)

    const invoicesQuery = supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, due_date, created_at, currency, subtotal, tax_amount, total, status, clients(name, email)')
      .eq('user_id', user.id)

    const { data, error } = await (invoicesQuery as any)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const invoices = ((data ?? []) as Array<AccountingInvoice & { created_at?: string | null }>)
      .sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0
        const bTime = b.created_at ? Date.parse(b.created_at) : 0
        return bTime - aTime
      })
      .map(({ created_at: _createdAt, ...invoice }) => invoice)
    if (invoices.length === 0) {
      return NextResponse.json({ error: 'No invoices found to export' }, { status: 400 })
    }

    const rows =
      format === 'quickbooks'
        ? buildQuickBooksRows(invoices, body.mapping)
        : format === 'xero'
          ? buildXeroRows(invoices, body.mapping)
          : buildInvoiceExportRows(invoices)

    const isExcel = format === 'excel'
    const payload = isExcel ? toExcelHtml(rows) : toCsv(rows)
    const extension = isExcel ? 'xls' : 'csv'
    const contentType = isExcel
      ? 'application/vnd.ms-excel; charset=utf-8'
      : 'text/csv; charset=utf-8'
    const timestamp = new Date().toISOString().slice(0, 10)

    return new Response(payload, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${format}-invoices-${timestamp}.${extension}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export accounting data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
