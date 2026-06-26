/**
 * Server-side subscription gating helpers.
 *
 * These functions are the authoritative application-level boundary for feature
 * access and resource limits. Count limits (invoices/clients/expenses) are ALSO
 * enforced at the database level via BEFORE INSERT triggers (see the
 * subscription_tiers migration) so they cannot be bypassed by direct inserts;
 * the helpers here provide friendly, pre-flight checks and gate non-count
 * features (AI, bank sync, audit log, SSO, custom branding, ...).
 *
 * All functions accept an already-constructed Supabase client so they can run
 * with either a user session (RLS) or the service-role admin client.
 */
import { DEFAULT_PLAN, getLimit, hasFeature, normalizePlanName } from '@/lib/subscriptions/plans'

// Resources that have a per-plan count limit, mapped to their table.
export const LIMITED_RESOURCES = {
  invoices: 'invoices',
  clients: 'clients',
  expenses: 'expenses',
}

/**
 * Resolve the canonical plan name for a user from the subscriptions table.
 * Falls back to the default (Free) plan when no row exists or on error.
 */
export async function getUserPlan(supabase, userId) {
  if (!userId) return DEFAULT_PLAN
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()
    return normalizePlanName(data?.plan)
  } catch {
    return DEFAULT_PLAN
  }
}

/**
 * Check whether a user's plan grants a feature.
 * Returns { allowed, plan, feature }.
 */
export async function checkFeature(supabase, userId, feature) {
  const plan = await getUserPlan(supabase, userId)
  return { allowed: hasFeature(plan, feature), plan, feature }
}

/**
 * Convenience guard for feature flags. Returns the same shape as checkFeature;
 * callers turn `allowed: false` into an HTTP 403.
 */
export async function requireFeature(supabase, userId, feature) {
  return checkFeature(supabase, userId, feature)
}

/**
 * Pre-flight check for whether a user may create `additional` rows of a limited
 * resource. Mirrors the database trigger so the UI can show a friendly message
 * before the insert is attempted.
 *
 * Returns { allowed, plan, limit, current, remaining }.
 * `limit === null` means unlimited.
 */
export async function canCreateResource(supabase, userId, resource, additional = 1) {
  const table = LIMITED_RESOURCES[resource]
  if (!table) {
    // Unknown resource is not gated.
    return { allowed: true, plan: DEFAULT_PLAN, limit: null, current: 0, remaining: null }
  }

  const plan = await getUserPlan(supabase, userId)
  const limit = getLimit(plan, resource)

  // Unlimited plan — always allowed.
  if (limit === null || limit === undefined) {
    return { allowed: true, plan, limit: null, current: 0, remaining: null }
  }

  let current = 0
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    current = count || 0
  } catch {
    // If we cannot count, defer to the database trigger as the hard boundary.
    return { allowed: true, plan, limit, current: 0, remaining: null }
  }

  const remaining = Math.max(0, limit - current)
  const allowed = current + additional <= limit
  return { allowed, plan, limit, current, remaining }
}

/**
 * Resolve the seat (team member) limit for a user's plan.
 * Returns a number, or null for unlimited (Enterprise).
 */
export async function getSeatLimit(supabase, userId) {
  const plan = await getUserPlan(supabase, userId)
  return getLimit(plan, 'teamMembers')
}
