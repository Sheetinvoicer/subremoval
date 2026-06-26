import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { recordAuditLog } from '@/lib/audit/log'
import { generateShareToken } from '@/lib/invoices/share'

// Owner-only management of an invoice's public share links. Creating a link
// issues an unguessable token (resolved publicly by the service-role route at
// app/api/public/invoice/[token]); revoking sets revoked_at. Create/revoke are
// recorded in the owner-visible invoice_history and mirrored to audit_logs.
//
// Bearer-authenticated + token-scoped so writes stay under the
// invoice_share_links RLS (auth.uid() = user_id); the detail page reads the
// active link directly under RLS.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SHARE_LINK_COLUMNS = 'id, token, expires_at, revoked_at, view_count, last_viewed_at, created_at'
const MAX_EXPIRY_DAYS = 365

interface ShareRequestBody {
  invoiceId?: string
  expiresInDays?: number | string | null
  expiresAt?: string | null
}

function bearerToken(request: Request): string | undefined {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization')
  return authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined
}

async function authenticate(request: Request) {
  const accessToken = bearerToken(request)
  const supabase = await createClient(accessToken)
  const {
    data: { user },
    error,
  } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

async function ownsInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  invoiceId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('invoices')
    .select('id')
    .eq('user_id', userId)
    .eq('id', invoiceId)
    .single()
  return Boolean(data)
}

// Resolves the optional expiry: an explicit ISO `expiresAt` wins; otherwise a
// positive `expiresInDays` (clamped to a year) is added to now; otherwise the
// link never expires.
function resolveExpiry(payload: ShareRequestBody): string | null {
  if (typeof payload.expiresAt === 'string' && payload.expiresAt.trim()) {
    const date = new Date(payload.expiresAt)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }
  if (payload.expiresInDays != null && payload.expiresInDays !== '') {
    const days = Number(payload.expiresInDays)
    if (Number.isFinite(days) && days > 0) {
      const clamped = Math.min(days, MAX_EXPIRY_DAYS)
      return new Date(Date.now() + clamped * 86_400_000).toISOString()
    }
  }
  return null
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = new URL(request.url).searchParams.get('invoiceId')?.trim()
    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }

    return await Sentry.startSpan(
      { name: 'invoices.share.get', op: 'http.server' },
      async () => {
        const { data, error } = await supabase
          .from('invoice_share_links')
          .select(SHARE_LINK_COLUMNS)
          .eq('user_id', user.id)
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: false })

        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // The newest link is the current one (creating a link revokes priors).
        return NextResponse.json({ link: (data && data[0]) || null })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to load share link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = (await request.json().catch(() => ({}))) as ShareRequestBody
    const invoiceId = typeof payload.invoiceId === 'string' ? payload.invoiceId.trim() : ''
    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }

    return await Sentry.startSpan(
      { name: 'invoices.share.create', op: 'http.server' },
      async () => {
        if (!(await ownsInvoice(supabase, user.id, invoiceId))) {
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const expiresAt = resolveExpiry(payload)
        const token = generateShareToken()

        // Enforce a single active link per invoice: revoke any prior live links
        // so the panel's one revoke control can never orphan a valid token.
        await supabase
          .from('invoice_share_links')
          .update({ revoked_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('invoice_id', invoiceId)
          .is('revoked_at', null)

        const { data: link, error } = await supabase
          .from('invoice_share_links')
          .insert({
            invoice_id: invoiceId,
            user_id: user.id,
            token,
            expires_at: expiresAt,
          })
          .select(SHARE_LINK_COLUMNS)
          .single()

        if (error || !link) {
          Sentry.captureException(error || new Error('Share link insert failed'))
          return NextResponse.json(
            { error: error?.message || 'Failed to create share link' },
            { status: 500 },
          )
        }

        await supabase.from('invoice_history').insert({
          invoice_id: invoiceId,
          user_id: user.id,
          action: 'share.created',
          before: null,
          after: { linkId: link.id, expiresAt },
        })

        await recordAuditLog({
          action: 'invoice.share_created',
          actor: { id: user.id, email: user.email },
          resourceType: 'invoice',
          resourceId: invoiceId,
          metadata: { linkId: link.id, expiresAt },
          request,
        })

        return NextResponse.json({ link }, { status: 201 })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to create share link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = new URL(request.url).searchParams
    const id = params.get('id')?.trim()
    const invoiceId = params.get('invoiceId')?.trim()
    if (!id && !invoiceId) {
      return NextResponse.json({ error: 'id or invoiceId is required' }, { status: 400 })
    }

    return await Sentry.startSpan(
      { name: 'invoices.share.revoke', op: 'http.server' },
      async () => {
        const revokedAt = new Date().toISOString()
        let query = supabase
          .from('invoice_share_links')
          .update({ revoked_at: revokedAt })
          .eq('user_id', user.id)

        // Revoke a specific link by id, or every still-active link for an invoice.
        query = id ? query.eq('id', id) : query.eq('invoice_id', invoiceId).is('revoked_at', null)

        const { error } = await query
        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        await supabase.from('invoice_history').insert({
          invoice_id: invoiceId || null,
          user_id: user.id,
          action: 'share.revoked',
          before: null,
          after: { linkId: id || null, invoiceId: invoiceId || null },
        })

        await recordAuditLog({
          action: 'invoice.share_revoked',
          actor: { id: user.id, email: user.email },
          resourceType: 'invoice',
          resourceId: invoiceId || id || null,
          metadata: { linkId: id || null },
          request,
        })

        return NextResponse.json({ ok: true })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to revoke share link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
