import { getStripeClient } from '@/lib/bank/connect'

// Stripe reports monetary amounts in the smallest currency unit (e.g. cents),
// while the rest of the app stores money in major units.
export function toMajorUnits(amount) {
  return Math.round(Number(amount || 0)) / 100
}

/**
 * Maps a Stripe balance transaction onto a `public.transactions` row for the
 * given user. Note that `matched_invoice_id` / `reconciled` are deliberately
 * omitted so that upserting an already-stored transaction never clobbers its
 * reconciliation state.
 */
export function mapBalanceTransaction(userId, tx) {
  return {
    user_id: userId,
    stripe_transaction_id: tx.id,
    amount: toMajorUnits(tx.amount),
    currency: (tx.currency || 'usd').toLowerCase(),
    description: tx.description || tx.type || null,
    type: tx.type || null,
    status: tx.status || 'available',
    transaction_date: new Date((tx.created || Date.now() / 1000) * 1000).toISOString(),
  }
}

/**
 * Imports balance transactions from a connected Stripe account into
 * `public.transactions` for a single user.
 *
 * The operation is idempotent: rows are upserted on
 * `(user_id, stripe_transaction_id)` so it is safe to call repeatedly (e.g. on
 * every webhook delivery and Stripe retry) without creating duplicates or
 * overwriting reconciliation state.
 *
 * @param {object}  params
 * @param {object}  params.supabase   Supabase client (admin or user-scoped).
 * @param {string}  params.userId     The app user that owns the transactions.
 * @param {string}  params.accountId  Connected Stripe account id (`acct_...`).
 * @param {number} [params.limit=100] How many transactions to pull (1–100).
 * @param {object} [params.stripe]    Optional Stripe client (created if absent).
 * @returns {Promise<{ synced: number, transactions: object[] }>}
 */
export async function syncTransactions({ supabase, userId, accountId, limit = 100, stripe } = {}) {
  if (!supabase) throw new Error('Missing Supabase client')
  if (!userId) throw new Error('Missing userId')
  if (!accountId) throw new Error('Missing connected Stripe account')

  const client = stripe || getStripeClient()
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100)

  const list = await client.balanceTransactions.list(
    { limit: safeLimit },
    { stripeAccount: accountId },
  )

  const rows = (list?.data || []).map((tx) => mapBalanceTransaction(userId, tx))

  if (rows.length === 0) {
    return { synced: 0, transactions: [] }
  }

  const { error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'user_id,stripe_transaction_id', ignoreDuplicates: false })

  if (error) {
    throw new Error(error.message)
  }

  return { synced: rows.length, transactions: rows }
}
