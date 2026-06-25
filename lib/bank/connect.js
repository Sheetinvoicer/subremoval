import Stripe from 'stripe'

// Cookie set by the Stripe Connect OAuth callback
// (`app/api/stripe/connect/callback/route.js`). It holds the connected
// account id (`acct_...`) that bank API calls must run against.
export const ACCOUNT_COOKIE = 'stripe_connect_account'

export function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }
  return new Stripe(stripeSecretKey)
}

/**
 * Resolves the Stripe connected account id for the current request.
 *
 * Prefers the value stored in `public.bank_connections` (durable, per user) and
 * falls back to the `stripe_connect_account` cookie written by the OAuth
 * callback. Returns `null` when the user has not connected a bank yet.
 */
export async function resolveConnectedAccountId(request, supabase, userId) {
  try {
    const { data } = await supabase
      .from('bank_connections')
      .select('stripe_account_id, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.stripe_account_id) {
      return data.stripe_account_id
    }
  } catch {
    // Table may be unavailable; fall through to the cookie.
  }

  const cookieValue = request.cookies.get(ACCOUNT_COOKIE)?.value
  if (cookieValue) {
    // Persist the cookie-derived account so future requests are durable.
    try {
      await supabase
        .from('bank_connections')
        .upsert(
          { user_id: userId, stripe_account_id: cookieValue, status: 'connected' },
          { onConflict: 'user_id,stripe_account_id' },
        )
    } catch {
      // Best-effort; ignore persistence failures.
    }
    return cookieValue
  }

  return null
}

export function getAccessToken(request) {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : undefined
}
