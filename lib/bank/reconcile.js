/**
 * Two transaction/invoice amounts are considered a match when they agree to the
 * cent, guarding against floating-point noise from currency conversions.
 */
export function amountsMatch(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.01
}

/**
 * Marks a single transaction as matched to an invoice and the invoice as paid.
 *
 * Every query is scoped to `userId` so the operation is safe under multi-tenant
 * access (and honours row-level security when run with a user-scoped client).
 */
export async function markMatched(supabase, userId, transactionId, invoiceId) {
  const { error: txError } = await supabase
    .from('transactions')
    .update({ matched_invoice_id: invoiceId, reconciled: true })
    .eq('id', transactionId)
    .eq('user_id', userId)

  if (txError) {
    throw new Error(txError.message)
  }

  const { error: invError } = await supabase
    .from('invoices')
    .update({ status: 'paid' })
    .eq('id', invoiceId)
    .eq('user_id', userId)

  if (invError) {
    throw new Error(invError.message)
  }
}

/**
 * Auto-reconciles every unmatched incoming payment against the first unpaid
 * invoice whose total equals the transaction amount, then marks those invoices
 * paid.
 *
 * The matching is idempotent: only transactions that are still unreconciled and
 * unmatched are considered, and each invoice can be consumed once, so replaying
 * the same webhook never double-matches.
 *
 * @param {object} params
 * @param {object} params.supabase  Supabase client (admin or user-scoped).
 * @param {string} params.userId    The app user whose books are reconciled.
 * @returns {Promise<{ matched: number, matches: { transactionId: string, invoiceId: string }[] }>}
 */
export async function autoReconcile({ supabase, userId } = {}) {
  if (!supabase) throw new Error('Missing Supabase client')
  if (!userId) throw new Error('Missing userId')

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, amount, reconciled, matched_invoice_id')
    .eq('user_id', userId)
    .eq('reconciled', false)
    .is('matched_invoice_id', null)

  if (txError) {
    throw new Error(txError.message)
  }

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('id, total, status')
    .eq('user_id', userId)
    .neq('status', 'paid')

  if (invError) {
    throw new Error(invError.message)
  }

  const available = [...(invoices || [])]
  const matches = []

  for (const tx of transactions || []) {
    // Only incoming payments (positive amounts) can settle an invoice.
    if (Number(tx.amount) <= 0) continue

    const idx = available.findIndex((inv) => amountsMatch(inv.total, tx.amount))
    if (idx === -1) continue

    const invoice = available.splice(idx, 1)[0]
    await markMatched(supabase, userId, tx.id, invoice.id)
    matches.push({ transactionId: tx.id, invoiceId: invoice.id })
  }

  return { matched: matches.length, matches }
}
