import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveConnectedAccountId, getAccessToken } from '@/lib/bank/connect'
import { syncTransactions } from '@/lib/bank/sync'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bank/transactions
 *
 * Imports balance transactions from the user's connected Stripe account, stores
 * them in `public.transactions`, and returns the stored list (joined with any
 * matched invoice). Pass `?sync=false` to read the stored rows without calling
 * Stripe, or `?limit=50` to control how many transactions are pulled.
 */
export async function GET(request) {
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

    const searchParams = request.nextUrl.searchParams
    const shouldSync = searchParams.get('sync') !== 'false'
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 100)

    let connected = true

    if (shouldSync) {
      const accountId = await resolveConnectedAccountId(request, supabase, user.id)

      if (!accountId) {
        connected = false
      } else {
        // Delegate to the shared sync helper so this route and the bank webhook
        // import balance transactions identically (idempotent upsert that
        // preserves reconciliation state).
        try {
          await syncTransactions({ supabase, userId: user.id, accountId, limit })
        } catch (syncError) {
          const message =
            syncError instanceof Error ? syncError.message : 'Failed to sync transactions'
          return NextResponse.json({ error: message }, { status: 500 })
        }
      }
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(
        'id, stripe_transaction_id, amount, currency, description, type, status, transaction_date, matched_invoice_id, reconciled, invoices:matched_invoice_id(id, invoice_number, total, status)',
      )
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ connected, transactions: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
