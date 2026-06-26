import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { sanitizePublicInvoice, shareLinkState } from '@/lib/invoices/share'

// Public, unauthenticated resolver for a share token. It runs with the
// service-role key (bypassing RLS) so an anonymous visitor can view a shared
// invoice without a session — exactly the pattern in lib/audit/log.js. Safety
// rests entirely on (1) validating the token is active (not revoked / expired)
// and (2) returning only the whitelisted fields from sanitizePublicInvoice.
// The public page calls ONLY this route; it never touches Supabase directly.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Columns needed to render the invoice publicly. sanitizePublicInvoice is the
// real gate — even if this list changes, only whitelisted fields are returned.
const PUBLIC_INVOICE_COLUMNS =
  'invoice_number, status, currency, subtotal, tax_rate_percentage, tax_amount, total, due_date, created_at, client_name, items, clients(name)'

function serviceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function notFound(reason: 'not_found' | 'expired' | 'revoked') {
  // A single 404 for every invalid case avoids leaking whether a token exists.
  return NextResponse.json({ error: reason, reason }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    const cleanToken = typeof token === 'string' ? token.trim() : ''
    if (!cleanToken) {
      return notFound('not_found')
    }

    return await Sentry.startSpan(
      { name: 'invoices.public.view', op: 'http.server' },
      async () => {
        const supabase = serviceRoleClient()

        const { data: link, error: linkError } = await supabase
          .from('invoice_share_links')
          .select('invoice_id, token, expires_at, revoked_at')
          .eq('token', cleanToken)
          .maybeSingle()

        if (linkError) {
          Sentry.captureException(linkError)
          return NextResponse.json({ error: 'Failed to resolve link' }, { status: 500 })
        }
        if (!link) {
          return notFound('not_found')
        }

        const state = shareLinkState(link)
        if (state !== 'active') {
          return notFound(state)
        }

        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select(PUBLIC_INVOICE_COLUMNS)
          .eq('id', link.invoice_id)
          .maybeSingle()

        if (invoiceError) {
          Sentry.captureException(invoiceError)
          return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
        }
        if (!invoice) {
          return notFound('not_found')
        }

        // Atomically bump aggregate view analytics for this active token.
        const { error: bumpError } = await supabase.rpc('increment_invoice_share_view', {
          p_token: cleanToken,
        })
        if (bumpError) {
          // A failed analytics bump must not block the view; just report it.
          Sentry.captureException(bumpError)
        }

        return NextResponse.json(
          { invoice: sanitizePublicInvoice(invoice as Record<string, unknown>) },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to load invoice'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
