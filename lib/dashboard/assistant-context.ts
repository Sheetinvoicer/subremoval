/**
 * Lightweight client-side store for the dashboard AI assistant context.
 *
 * The chat widget lives in the dashboard layout, but the metrics snapshot it
 * sends to the assistant is computed by the dashboard page. This tiny pub/sub
 * lets the page publish the latest snapshot without prop-drilling through the
 * layout. It is intentionally free of any server-only dependency (no Anthropic
 * SDK) so it is safe to import from client components.
 */

/** A compact, serialisable snapshot of the user's dashboard metrics. */
export interface AssistantContext {
  currency?: string
  totalRevenue?: number
  netProfit?: number
  totalExpenses?: number
  pendingAmount?: number
  pendingCount?: number
  overdueAmount?: number
  overdueCount?: number
  paidThisMonth?: number
  totalInvoices?: number
  totalClients?: number
  revenueChangePct?: number
  forecastNextMonth?: number
}

type Listener = (context: AssistantContext | null) => void

let current: AssistantContext | null = null
const listeners = new Set<Listener>()

/** Publish the latest metrics snapshot and notify subscribers. */
export function setAssistantContext(context: AssistantContext | null): void {
  current = context
  listeners.forEach((listener) => listener(current))
}

/** Read the most recently published snapshot (or null). */
export function getAssistantContext(): AssistantContext | null {
  return current
}

/** Subscribe to snapshot updates. Returns an unsubscribe function. */
export function subscribeAssistantContext(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
