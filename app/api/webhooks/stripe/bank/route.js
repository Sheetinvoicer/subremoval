import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/subscriptions/store'
import { getStripeClient } from '@/lib/bank/connect'
import { syncTransactions } from '@/lib/bank/sync'
import { autoReconcile } from '@/lib/bank/reconcile'

// Webhooks must read the raw, unbuffered body to verify the Stripe signature, so
// the route can never be statically optimised.
export const dynamic = 'force-dynamic'

/**
 * Stripe Connect events that signal new balance/bank activity on a connected
 * account. Any of them triggers a transaction re-sync followed by
 * auto-reconciliation for the account's owner.
 */
const SYNC_EVENTS = new Set([
  'balance.available',
  'charge.succeeded',
  'charge.captured',
  'charge.refunded',
  'payout.paid',
  'payout.created',
  'payout.failed',
  'financial_connections.account.refreshed_transactions',
])

// A dedicated secret keeps the bank webhook independent from the billing
// webhook (`STRIPE_WEBHOOK_SECRET`), but we fall back to it for convenience.
function getWebhookSecret() {
  return process.env.STRIPE_BANK_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
}

// Resolve the app user that owns a given connected Stripe account.
async function resolveUserIdForAccount(supabase, accountId) {
  if (!accountId) return null

  const { data } = await supabase
    .from('bank_connections')
    .select('user_id, status, created_at')
    .eq('stripe_account_id', accountId)
    .eq('status', 'connected')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.user_id || null
}

/**
 * POST /api/webhooks/stripe/bank
 *
 * Receives Stripe Connect webhooks for connected accounts, re-syncs that
 * account's balance transactions into `public.transactions`, and auto-reconciles
 * them against open invoices. The whole pipeline is idempotent, so Stripe
 * retries (and duplicate deliveries) are harmless.
 */
export async function POST(request) {
  let event

  // -- 1. Verify the signature. A failure here is the caller's fault (bad/forged
  //       payload), so reject with 400 and do not touch the database.
  try {
    const webhookSecret = getWebhookSecret()
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Missing STRIPE_BANK_WEBHOOK_SECRET' },
        { status: 500 },
      )
    }

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const rawBody = await request.text()
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // -- 2. Process the (now trusted) event.
  try {
    if (!SYNC_EVENTS.has(event.type)) {
      return NextResponse.json({ received: true, ignored: event.type })
    }

    // Connect webhooks carry the connected account id on the top-level
    // `event.account` field.
    const accountId = event.account || null
    const supabase = createAdminClient()
    const userId = await resolveUserIdForAccount(supabase, accountId)

    if (!accountId || !userId) {
      // Nothing actionable (account not linked to a user). Acknowledge so Stripe
      // does not retry indefinitely.
      return NextResponse.json({ received: true, matched: 0, reason: 'no_linked_user' })
    }

    const stripe = getStripeClient()
    const { synced } = await syncTransactions({ supabase, userId, accountId, stripe })
    const { matched } = await autoReconcile({ supabase, userId })

    return NextResponse.json({ received: true, event: event.type, synced, matched })
  } catch (error) {
    // Transient failures (DB/Stripe) return 500 so Stripe retries on its backoff
    // schedule; idempotency makes the retry safe.
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
