/**
 * Backwards-compatible resource-limit helpers.
 *
 * Historically this module read a non-existent `user_profiles` table from a
 * browser client and hard-coded a 5-invoice limit. It now delegates to the
 * central, server-side gating helpers in lib/subscriptions/gate.js, which read
 * the real plan from the `subscriptions` table and the limits from
 * lib/subscriptions/plans.js. The database BEFORE INSERT triggers remain the
 * hard enforcement boundary; these helpers provide friendly pre-flight checks.
 *
 * Each function accepts an optional Supabase client so callers (route handlers,
 * server actions, tests) can pass their own; when omitted a server client is
 * created lazily to avoid pulling server-only modules into the client bundle.
 */
import { canCreateResource } from '@/lib/subscriptions/gate'
import { getPlan } from '@/lib/subscriptions/plans'

async function resolveSupabase(supabase) {
  if (supabase) return supabase
  const mod = await import('@/lib/supabase/server')
  return mod.createClient()
}

function buildMessage(resource, result) {
  if (result.allowed) return null
  const noun = { invoices: 'invoices', clients: 'clients', expenses: 'expenses' }[resource] || resource
  return `Your ${getPlan(result.plan).name} plan is limited to ${result.limit} ${noun}. You have ${result.current}/${result.limit}. Upgrade to Pro for unlimited ${noun}.`
}

async function checkResource(resource, userId, count, supabaseClient) {
  const supabase = await resolveSupabase(supabaseClient)
  const result = await canCreateResource(supabase, userId, resource, count)
  return { allowed: result.allowed, message: buildMessage(resource, result), ...result }
}

export async function canCreateInvoice(userId, newInvoiceCount = 1, supabaseClient) {
  return checkResource('invoices', userId, newInvoiceCount, supabaseClient)
}

export async function canCreateClient(userId, newClientCount = 1, supabaseClient) {
  return checkResource('clients', userId, newClientCount, supabaseClient)
}

export async function canCreateExpense(userId, newExpenseCount = 1, supabaseClient) {
  return checkResource('expenses', userId, newExpenseCount, supabaseClient)
}
