/**
 * Pure, framework-agnostic helpers for invoice share links and public payloads.
 *
 * Kept free of React/Supabase imports so it can be unit-tested in isolation and
 * imported by both the browser (ShareLinkPanel) and the server (share route +
 * the public, service-role route). `generateShareToken` uses the universal Web
 * Crypto global (available in Node and the browser) rather than a Node-only
 * import so this module stays safe to bundle on the client.
 */

// The comment audience the schema accepts. Kept here as the single source of
// truth so the API route, the UI and any validation stay in sync. Comments are
// internal this phase; `client` is reserved for a future client-visible thread.
export const COMMENT_AUDIENCES = ['team', 'client'] as const
export type CommentAudience = (typeof COMMENT_AUDIENCES)[number]

export function isCommentAudience(value: unknown): value is CommentAudience {
  return typeof value === 'string' && (COMMENT_AUDIENCES as readonly string[]).includes(value)
}

// The public path a share token resolves to (the page at app/(public)/invoice/[token]).
export const SHARE_LINK_PATH_PREFIX = '/invoice'

/** Builds the path (not absolute URL) a token resolves to: `/invoice/<token>`. */
export function shareLinkPath(token: string): string {
  return `${SHARE_LINK_PATH_PREFIX}/${encodeURIComponent(token)}`
}

// Default token entropy: 32 random bytes -> 64 hex chars (256 bits), unguessable.
export const SHARE_TOKEN_BYTES = 32

/**
 * Generates an unguessable, URL-safe share token (hex-encoded random bytes).
 * Uses the global Web Crypto API so it works in the Node route runtime and in
 * the browser without a Node-only `crypto` import.
 */
export function generateShareToken(byteLength: number = SHARE_TOKEN_BYTES): string {
  const length = Number.isInteger(byteLength) && byteLength > 0 ? byteLength : SHARE_TOKEN_BYTES
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type ShareLinkState = 'active' | 'expired' | 'revoked'

export interface ShareLinkLike {
  expires_at?: string | null
  revoked_at?: string | null
}

/**
 * Classifies a share link. Revocation wins over expiry; a link with an
 * `expires_at` at or before `now` is `expired` (boundary treated as expired);
 * otherwise it is `active`.
 */
export function shareLinkState(link: ShareLinkLike, now: Date = new Date()): ShareLinkState {
  if (link?.revoked_at) return 'revoked'
  if (link?.expires_at) {
    const expiresAt = new Date(link.expires_at).getTime()
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return 'expired'
  }
  return 'active'
}

/** Convenience: true only when a link is neither revoked nor expired. */
export function isShareLinkActive(link: ShareLinkLike, now: Date = new Date()): boolean {
  return shareLinkState(link, now) === 'active'
}

export interface PublicInvoiceItem {
  description: string
  quantity: number
  price: number
  total: number
}

// The whitelisted, client-safe shape returned by the public route. Deliberately
// omits user_id, internal notes/metadata/tags, project linkage, client email,
// and any other field not needed to display the invoice to a recipient.
export interface PublicInvoice {
  invoiceNumber: string | null
  status: string | null
  currency: string
  subtotal: number
  taxRatePercentage: number
  taxAmount: number
  total: number
  dueDate: string | null
  createdAt: string | null
  clientName: string | null
  items: PublicInvoiceItem[]
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value)
  return s.length ? s : null
}

function sanitizeItems(value: unknown): PublicInvoiceItem[] {
  if (!Array.isArray(value)) return []
  return value.map((raw) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const quantity = toNumber(item.quantity)
    const price = toNumber(item.price)
    const total = item.total != null ? toNumber(item.total) : quantity * price
    return {
      description: toStringOrNull(item.description) ?? '',
      quantity,
      price,
      total,
    }
  })
}

/**
 * Whitelists an invoice row into the public, client-safe payload. Defense in
 * depth: even if the caller over-selects columns, only the fields below ever
 * reach the public response. Accepts either a denormalized `client_name` or an
 * embedded `clients: { name }` relation.
 */
export function sanitizePublicInvoice(invoice: Record<string, unknown> | null | undefined): PublicInvoice {
  const inv = (invoice && typeof invoice === 'object' ? invoice : {}) as Record<string, unknown>
  const clients = (inv.clients && typeof inv.clients === 'object' ? inv.clients : null) as
    | Record<string, unknown>
    | null

  return {
    invoiceNumber: toStringOrNull(inv.invoice_number),
    status: toStringOrNull(inv.status),
    currency: toStringOrNull(inv.currency) ?? 'USD',
    subtotal: toNumber(inv.subtotal),
    taxRatePercentage: toNumber(inv.tax_rate_percentage),
    taxAmount: toNumber(inv.tax_amount),
    total: toNumber(inv.total),
    dueDate: toStringOrNull(inv.due_date),
    createdAt: toStringOrNull(inv.created_at),
    clientName: toStringOrNull(inv.client_name) ?? toStringOrNull(clients?.name),
    items: sanitizeItems(inv.items),
  }
}
