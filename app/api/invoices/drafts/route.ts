import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

// Versioned, owner-scoped auto-save drafts for the invoice editor. All access
// runs through this bearer-authenticated, token-scoped client so it stays under
// the invoice_drafts RLS (auth.uid() = user_id). Drafts are grouped by a
// `draft_key` — the invoice id when editing, or the literal 'new' when creating.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Keep only the most recent N versions per (user, draft_key); older snapshots are
// pruned after each save so the table can't grow without bound.
const MAX_DRAFT_VERSIONS = 10
// Reject payloads larger than this (serialized) to avoid abuse / runaway rows.
const MAX_PAYLOAD_BYTES = 200_000

interface DraftRequestBody {
  invoiceId?: string | null
  payload?: unknown
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

// Normalizes the editor target into a stable grouping key. Anything falsy or the
// literal 'new' maps to the shared "new invoice" draft for that user.
function toDraftKey(invoiceId: string | null | undefined): string {
  const trimmed = typeof invoiceId === 'string' ? invoiceId.trim() : ''
  return trimmed && trimmed !== 'new' ? trimmed : 'new'
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const draftKey = toDraftKey(new URL(request.url).searchParams.get('invoiceId'))

    return await Sentry.startSpan(
      { name: 'invoices.drafts.list', op: 'http.server' },
      async () => {
        const { data, error } = await supabase
          .from('invoice_drafts')
          .select('id, invoice_id, draft_key, version, payload, created_at')
          .eq('user_id', user.id)
          .eq('draft_key', draftKey)
          .order('version', { ascending: false })

        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const versions = data || []
        return NextResponse.json({ latest: versions[0] || null, versions })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to load drafts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as DraftRequestBody
    const payload = body?.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'payload must be an object' }, { status: 400 })
    }
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Draft payload is too large' }, { status: 413 })
    }

    const invoiceId =
      typeof body.invoiceId === 'string' && body.invoiceId.trim() && body.invoiceId.trim() !== 'new'
        ? body.invoiceId.trim()
        : null
    const draftKey = toDraftKey(body.invoiceId)

    return await Sentry.startSpan(
      { name: 'invoices.drafts.save', op: 'http.server' },
      async () => {
        // Next version for this key = current max + 1 (starts at 1).
        const { data: latest, error: latestError } = await supabase
          .from('invoice_drafts')
          .select('version')
          .eq('user_id', user.id)
          .eq('draft_key', draftKey)
          .order('version', { ascending: false })
          .limit(1)

        if (latestError) {
          Sentry.captureException(latestError)
          return NextResponse.json({ error: latestError.message }, { status: 500 })
        }

        const nextVersion = (latest?.[0]?.version || 0) + 1

        const { data: inserted, error: insertError } = await supabase
          .from('invoice_drafts')
          .insert({
            user_id: user.id,
            invoice_id: invoiceId,
            draft_key: draftKey,
            version: nextVersion,
            payload,
          })
          .select('id, invoice_id, draft_key, version, payload, created_at')
          .single()

        if (insertError) {
          Sentry.captureException(insertError)
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        // Prune anything older than the retained window. Best-effort: a failure
        // here doesn't undo the successful save.
        const pruneBelow = nextVersion - MAX_DRAFT_VERSIONS
        if (pruneBelow > 0) {
          const { error: pruneError } = await supabase
            .from('invoice_drafts')
            .delete()
            .eq('user_id', user.id)
            .eq('draft_key', draftKey)
            .lte('version', pruneBelow)
          if (pruneError) Sentry.captureException(pruneError)
        }

        return NextResponse.json({ draft: inserted })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to save draft'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const draftKey = toDraftKey(new URL(request.url).searchParams.get('invoiceId'))

    return await Sentry.startSpan(
      { name: 'invoices.drafts.discard', op: 'http.server' },
      async () => {
        const { error } = await supabase
          .from('invoice_drafts')
          .delete()
          .eq('user_id', user.id)
          .eq('draft_key', draftKey)

        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to discard draft'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
