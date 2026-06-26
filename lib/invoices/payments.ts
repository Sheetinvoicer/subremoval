/**
 * Pure, framework-agnostic money math for invoice partial-payment tracking.
 *
 * Kept free of React/Supabase imports so it can be unit-tested in isolation and
 * reused by both the browser (PaymentTracker) and the server payments route.
 */

// The full invoice status lifecycle the detail page can set and the timeline
// visualizes. The first four are the linear "happy path"; the last three are
// terminal/branch states. Kept here as the single source of truth so the UI,
// the timeline and any validation stay in sync.
export const INVOICE_STATUS_LIFECYCLE = [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'disputed',
  'cancelled',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUS_LIFECYCLE)[number]

// The ordered "happy path" used by the timeline to render progress; the
// remaining lifecycle states are rendered as branch flags.
export const INVOICE_STATUS_FLOW: InvoiceStatus[] = ['draft', 'sent', 'viewed', 'paid']
export const INVOICE_STATUS_BRANCHES: InvoiceStatus[] = ['overdue', 'disputed', 'cancelled']

export const PAYMENT_KINDS = ['payment', 'credit', 'adjustment'] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === 'string' && (INVOICE_STATUS_LIFECYCLE as readonly string[]).includes(value)
}

export function isPaymentKind(value: unknown): value is PaymentKind {
  return typeof value === 'string' && (PAYMENT_KINDS as readonly string[]).includes(value)
}

// A row is only "fully paid" once the balance reaches zero. Money is stored with
// 2 decimals, so anything within half a cent of zero is treated as settled to
// absorb floating-point drift from summing many entries.
export const PAYMENT_EPSILON = 0.005

/** Rounds a monetary value to 2 decimals (matching the create page's tax math). */
export function roundMoney(value: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round((numeric + Number.EPSILON) * 100) / 100
}

export interface PaymentBalance {
  /** Total recorded against the invoice (payments + credits + adjustments). */
  paid: number
  /** Remaining amount owed: round(total - paid, 2); clamped so it never shows as -0. */
  balance: number
  /** True once recorded amounts cover the invoice total (within PAYMENT_EPSILON). */
  fullyPaid: boolean
}

/**
 * Sums every recorded entry's `amount` against the invoice total. All kinds
 * (payment, credit, adjustment) reduce what's owed — `kind` is a descriptive
 * label for the entry, not a sign change — so corrections are made by recording
 * a negative `adjustment`/`credit` amount.
 */
export function computeBalance(
  total: number,
  payments: ReadonlyArray<{ amount: number | string | null | undefined }>,
): PaymentBalance {
  const numericTotal = roundMoney(Number(total) || 0)
  const paid = roundMoney(
    (payments || []).reduce((sum, entry) => sum + (Number(entry?.amount) || 0), 0),
  )
  const rawBalance = roundMoney(numericTotal - paid)
  const fullyPaid = paid + PAYMENT_EPSILON >= numericTotal
  // Avoid surfacing a confusing "-0.00" or tiny negative residue once settled.
  const balance = Object.is(rawBalance, -0) ? 0 : rawBalance
  return { paid, balance, fullyPaid }
}
