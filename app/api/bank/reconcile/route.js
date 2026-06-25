import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessToken } from '@/lib/bank/connect'
import { autoReconcile, markMatched } from '@/lib/bank/reconcile'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bank/reconcile
 *
 * Body:
 *   - { transactionId, invoiceId }  → manually match a transaction to an invoice
 *     and mark that invoice paid.
 *   - { auto: true }                → auto-reconcile every unmatched incoming
 *     payment against the first unpaid invoice whose total equals the
 *     transaction amount, then mark those invoices paid.
 */
export async function POST(request) {
  try {
    const accessToken = getAccessToken(request)
    const supabase = await createClient(accessToken)

    const {
      data: { user },
      error: userError,
    } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    // -------------------------------------------------------------------
    // Manual single match
    // -------------------------------------------------------------------
    if (body.transactionId && body.invoiceId) {
      await markMatched(supabase, user.id, body.transactionId, body.invoiceId)
      return NextResponse.json({ matched: 1 })
    }

    // -------------------------------------------------------------------
    // Auto-reconciliation
    // -------------------------------------------------------------------
    if (body.auto) {
      // Shared with the bank webhook so manual and webhook-driven runs match.
      const { matched, matches } = await autoReconcile({ supabase, userId: user.id })
      return NextResponse.json({ matched, matches })
    }

    return NextResponse.json(
      { error: 'Provide { transactionId, invoiceId } or { auto: true }' },
      { status: 400 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconcile'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
