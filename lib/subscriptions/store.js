import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client authenticated with the service-role key.
 * Required for webhook handlers that run without a user session.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Map a configured Stripe price ID back to a friendly plan name.
 */
export function resolvePlanFromPriceId(priceId) {
  if (!priceId) return null
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
  const businessPriceId =
    process.env.STRIPE_BUSINESS_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID

  if (priceId === proPriceId) return 'Pro'
  if (priceId === businessPriceId) return 'Business'
  return null
}

/**
 * Upsert subscription state for a user. Only the provided fields are written.
 * The row is matched by user_id when available, otherwise by stripe_subscription_id.
 */
export async function upsertSubscriptionRecord(supabase, { userId, stripeSubscriptionId }, fields) {
  const payload = { ...fields, updated_at: new Date().toISOString() }

  if (userId) {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return supabase.from('subscriptions').update(payload).eq('user_id', userId)
    }

    return supabase.from('subscriptions').insert({ user_id: userId, ...payload })
  }

  if (stripeSubscriptionId) {
    return supabase
      .from('subscriptions')
      .update(payload)
      .eq('stripe_subscription_id', stripeSubscriptionId)
  }

  return { error: new Error('No identifier provided to update subscription') }
}
