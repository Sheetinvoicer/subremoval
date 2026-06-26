/**
 * Pure, framework-agnostic money engine for the invoice editor.
 *
 * Kept free of React/Supabase imports so it can be unit-tested in isolation and
 * reused by both the editor UI and any server code. It computes the persisted
 * roll-ups the rest of the app already reads (`subtotal`, `tax_amount`,
 * `total`, plus a blended `tax_rate_percentage`) from a richer authoring model:
 * per-line tax rates (multi-rate), an inclusive/exclusive tax mode, a fixed or
 * percentage invoice discount, and an optional rounding increment.
 *
 * Invariants (all amounts rounded to 2 decimals):
 *   subtotal       = Σ line.net                       (net of tax, pre-discount)
 *   discountAmount ≤ subtotal                         (clamped)
 *   taxAmount      = Σ line.tax                        (computed on the discounted base)
 *   total          = subtotal − discountAmount + taxAmount + roundingAdjustment
 *
 * The discount is allocated across lines with a largest-remainder method so the
 * per-line discounts always sum exactly to `discountAmount` (no penny drift).
 */

export type DiscountType = 'percent' | 'fixed'
export type TaxMode = 'exclusive' | 'inclusive'

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const
export const TAX_MODES = ['exclusive', 'inclusive'] as const

export interface MoneyLineInput {
  quantity: number | string | null | undefined
  price: number | string | null | undefined
  /** Per-line tax rate (%). Falls back to the invoice-level rate when nullish. */
  taxRate?: number | string | null
}

export interface DiscountInput {
  type: DiscountType
  value: number | string | null | undefined
}

export interface InvoiceMoneyInput {
  items: ReadonlyArray<MoneyLineInput>
  /** Default tax rate (%) applied to lines that don't carry their own. */
  invoiceTaxRate?: number | string | null
  /** Whether line prices include tax ('inclusive') or add it on top ('exclusive'). */
  taxMode?: TaxMode
  discount?: DiscountInput | null
  /** Round the grand total to the nearest increment (e.g. 0.05). 0 disables it. */
  roundingIncrement?: number | string | null
}

export interface InvoiceMoneyLine {
  /** Line amount net of tax, before discount. */
  net: number
  /** Share of the invoice discount allocated to this line. */
  discount: number
  /** Net minus the allocated discount — the base the line's tax is computed on. */
  taxable: number
  /** Tax for this line: round(taxable * rate / 100). */
  tax: number
  /** Effective tax rate (%) used for this line. */
  rate: number
}

export interface InvoiceMoney {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  /** total adjustment introduced by the rounding increment (can be negative). */
  roundingAdjustment: number
  /** Blended rate persisted as `tax_rate_percentage`: tax / (subtotal − discount). */
  effectiveTaxRate: number
  lines: InvoiceMoneyLine[]
}

/** Rounds a monetary value to 2 decimals (matches `roundMoney` in payments.ts). */
export function round2(value: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round((numeric + Number.EPSILON) * 100) / 100
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

/** Clamps a tax rate to a sane percentage window [0, 100]. */
function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0
  return Math.min(100, Math.max(0, rate))
}

/**
 * Normalizes a discount into a `{ type, value }` with a non-negative value;
 * percentages are additionally clamped to [0, 100]. An unknown/empty discount
 * becomes a zero percentage (a no-op).
 */
export function normalizeDiscount(discount: DiscountInput | null | undefined): {
  type: DiscountType
  value: number
} {
  const type: DiscountType = discount?.type === 'fixed' ? 'fixed' : 'percent'
  const raw = Math.max(0, toFiniteNumber(discount?.value, 0))
  return { type, value: type === 'percent' ? Math.min(raw, 100) : raw }
}

/**
 * Splits `amount` across the given `weights` (which sum to `weightSum`) so the
 * pieces are proportional and sum back to `amount` exactly, distributing the
 * leftover cents to the largest fractional remainders (largest-remainder method).
 */
function allocateProportionally(amount: number, weights: number[], weightSum: number): number[] {
  const n = weights.length
  if (n === 0) return []
  if (!(amount > 0) || !(weightSum > 0)) return weights.map(() => 0)

  const totalCents = Math.round(amount * 100)
  const exact = weights.map((w) => (totalCents * Math.max(0, w)) / weightSum)
  const cents = exact.map((c) => Math.floor(c))
  let remainder = totalCents - cents.reduce((sum, c) => sum + c, 0)

  // Hand out the remaining cents to the largest fractional parts first.
  const order = exact
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)

  for (let k = 0; k < order.length && remainder > 0; k += 1) {
    cents[order[k].i] += 1
    remainder -= 1
  }

  return cents.map((c) => c / 100)
}

/**
 * Computes the full money breakdown for an invoice from the editor's authoring
 * model. Deterministic and side-effect free; every returned amount is rounded
 * to 2 decimals.
 */
export function computeInvoiceMoney(input: InvoiceMoneyInput): InvoiceMoney {
  const taxMode: TaxMode = input?.taxMode === 'inclusive' ? 'inclusive' : 'exclusive'
  const invoiceRate = clampRate(toFiniteNumber(input?.invoiceTaxRate, 0))
  const items = Array.isArray(input?.items) ? input.items : []

  // Per-line net (pre-discount) + effective rate. Inclusive prices have the tax
  // backed out so `net` is always tax-exclusive, keeping the roll-ups uniform.
  const baseLines = items.map((item) => {
    const quantity = Math.max(0, toFiniteNumber(item?.quantity, 0))
    const price = toFiniteNumber(item?.price, 0)
    const hasOwnRate = item?.taxRate !== null && item?.taxRate !== undefined && item?.taxRate !== ''
    const rate = clampRate(hasOwnRate ? toFiniteNumber(item?.taxRate, invoiceRate) : invoiceRate)
    const gross = quantity * price
    const net = taxMode === 'inclusive' ? gross / (1 + rate / 100) : gross
    return { net: round2(net), rate }
  })

  const subtotal = round2(baseLines.reduce((sum, line) => sum + line.net, 0))

  // Invoice-level discount applied to the subtotal, then clamped so it can never
  // exceed it (a fixed discount larger than the subtotal zeroes the base).
  const discount = normalizeDiscount(input?.discount)
  let discountAmount = 0
  if (subtotal > 0 && discount.value > 0) {
    discountAmount =
      discount.type === 'percent'
        ? round2((subtotal * discount.value) / 100)
        : round2(discount.value)
  }
  discountAmount = Math.min(discountAmount, subtotal)

  const lineDiscounts = allocateProportionally(
    discountAmount,
    baseLines.map((line) => line.net),
    subtotal,
  )

  const lines: InvoiceMoneyLine[] = baseLines.map((line, index) => {
    const lineDiscount = lineDiscounts[index] || 0
    const taxable = Math.max(0, round2(line.net - lineDiscount))
    const tax = round2((taxable * line.rate) / 100)
    return { net: line.net, discount: lineDiscount, taxable, tax, rate: line.rate }
  })

  const taxAmount = round2(lines.reduce((sum, line) => sum + line.tax, 0))
  const preRoundTotal = round2(subtotal - discountAmount + taxAmount)

  // Optional rounding to the nearest increment (e.g. 0.05); the delta is exposed
  // so callers can show/audit it.
  const increment = Math.max(0, toFiniteNumber(input?.roundingIncrement, 0))
  let total = preRoundTotal
  let roundingAdjustment = 0
  if (increment > 0) {
    total = round2(Math.round(preRoundTotal / increment) * increment)
    roundingAdjustment = round2(total - preRoundTotal)
  }

  const taxableTotal = round2(subtotal - discountAmount)
  const effectiveTaxRate = taxableTotal > 0 ? round2((taxAmount / taxableTotal) * 100) : 0

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
    roundingAdjustment,
    effectiveTaxRate,
    lines,
  }
}
