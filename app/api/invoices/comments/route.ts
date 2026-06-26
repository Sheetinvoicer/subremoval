import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { isCommentAudience, type CommentAudience } from '@/lib/invoices/share'

// Owner-only CRUD for an invoice's threaded internal comments. All access runs
// through this bearer-authenticated, token-scoped client so it stays under the
// invoice_comments RLS (auth.uid() = user_id); the detail page reads the thread
// directly under RLS too, but writes funnel here for a single validated path.
//
// Comments are internal this phase: they are never returned by the public share
// route and the public page renders none.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_COMMENT_LENGTH = 4000

interface CommentRequestBody {
  invoiceId?: string
  body?: string
  audience?: string
  parentId?: string | null
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

// Confirms the invoice belongs to the authenticated user so a comment can never
// be attached to (or listed for) someone else's invoice.
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
      { name: 'invoices.comments.list', op: 'http.server' },
      async () => {
        const { data, error } = await supabase
          .from('invoice_comments')
          .select('id, invoice_id, parent_id, audience, body, created_at')
          .eq('user_id', user.id)
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: true })

        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ comments: data || [] })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to load comments'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = (await request.json().catch(() => ({}))) as CommentRequestBody
    const invoiceId = typeof payload.invoiceId === 'string' ? payload.invoiceId.trim() : ''
    const body = typeof payload.body === 'string' ? payload.body.trim() : ''
    const audience: CommentAudience = isCommentAudience(payload.audience) ? payload.audience : 'team'
    const parentId =
      typeof payload.parentId === 'string' && payload.parentId.trim() ? payload.parentId.trim() : null

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }
    if (!body) {
      return NextResponse.json({ error: 'A comment body is required' }, { status: 400 })
    }
    if (body.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: 'Comment is too long' }, { status: 400 })
    }

    return await Sentry.startSpan(
      { name: 'invoices.comments.add', op: 'http.server', attributes: { audience } },
      async () => {
        if (!(await ownsInvoice(supabase, user.id, invoiceId))) {
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const { data, error } = await supabase
          .from('invoice_comments')
          .insert({
            invoice_id: invoiceId,
            user_id: user.id,
            parent_id: parentId,
            audience,
            body,
          })
          .select('id, invoice_id, parent_id, audience, body, created_at')
          .single()

        if (error || !data) {
          Sentry.captureException(error || new Error('Comment insert failed'))
          return NextResponse.json(
            { error: error?.message || 'Failed to add comment' },
            { status: 500 },
          )
        }

        return NextResponse.json({ comment: data }, { status: 201 })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to add comment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')?.trim()
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    return await Sentry.startSpan(
      { name: 'invoices.comments.delete', op: 'http.server' },
      async () => {
        // RLS plus the explicit user_id filter guarantee a user can only delete
        // their own comment (and, via cascade, its replies).
        const { error } = await supabase
          .from('invoice_comments')
          .delete()
          .eq('user_id', user.id)
          .eq('id', id)

        if (error) {
          Sentry.captureException(error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to delete comment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
