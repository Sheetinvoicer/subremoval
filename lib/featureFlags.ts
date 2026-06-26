/**
 * Lightweight, env-driven feature flags for the enterprise invoicing rollout.
 *
 * Each new surface ships behind a `NEXT_PUBLIC_FF_*` flag so it can be rolled
 * out (or instantly rolled back) on Vercel by flipping an environment variable
 * — no redeploy of code required, just a redeploy of env. Because the values
 * are `NEXT_PUBLIC_*`, Next.js inlines them at build time, so the result is a
 * build-time constant that is identical on the server and the client (no
 * hydration mismatch).
 *
 * References to `process.env.NEXT_PUBLIC_FF_*` MUST be static (not computed)
 * for Next.js to inline them — that's why each flag is listed explicitly below.
 */

export type FeatureFlag =
  | 'invoiceListV2'
  | 'invoiceDetailV2'
  | 'invoiceEditorV2'
  | 'invoiceGenerationV2'

const FLAG_ENV: Record<FeatureFlag, string | undefined> = {
  invoiceListV2: process.env.NEXT_PUBLIC_FF_INVOICE_LIST_V2,
  invoiceDetailV2: process.env.NEXT_PUBLIC_FF_INVOICE_DETAIL_V2,
  invoiceEditorV2: process.env.NEXT_PUBLIC_FF_INVOICE_EDITOR_V2,
  invoiceGenerationV2: process.env.NEXT_PUBLIC_FF_INVOICE_GENERATION_V2,
}

// Flags default ON so the enterprise experience is the baseline; an operator
// flips one OFF (e.g. `NEXT_PUBLIC_FF_INVOICE_LIST_V2=false`) to roll back to
// the lean fallback while keeping the deploy live.
const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  invoiceListV2: true,
  invoiceDetailV2: true,
  invoiceEditorV2: true,
  invoiceGenerationV2: true,
}

function parseFlag(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined
  const value = raw.trim().toLowerCase()
  if (value === '') return undefined
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(value)) return true
  if (['0', 'false', 'off', 'no', 'disabled'].includes(value)) return false
  return undefined
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const parsed = parseFlag(FLAG_ENV[flag])
  return parsed ?? FLAG_DEFAULTS[flag]
}
