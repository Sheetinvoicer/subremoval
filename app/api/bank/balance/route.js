import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getStripeClient,
  resolveConnectedAccountId,
  getAccessToken,
} from '@/lib/bank/connect'

export const dynamic = 'force-dynamic'

function toMajorUnits(amount) {
  return Math.round(Number(amount || 0)) / 100
}

// Collapses Stripe's per-currency balance buckets into a simple list.
function mapBuckets(buckets) {
  return (buckets || []).map((bucket) => ({
    amount: toMajorUnits(bucket.amount),
    currency: (bucket.currency || 'usd').toLowerCase(),
  }))
}

/**
 * GET /api/bank/balance
 *
 * Returns the available and pending balances of the user's connected Stripe
 * account. Responds with `{ connected: false }` when no bank is linked yet.
 */
export async function GET(request) {
  try {
    const accessToken = getAccessToken(request)
    const supabase = await createClient(accessToken)

    const {
      data: { user },
      error: userError,
    } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveConnectedAccountId(request, supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ connected: false, available: [], pending: [] })
    }

    const stripe = getStripeClient()
    const balance = await stripe.balance.retrieve({ stripeAccount: accountId })

    return NextResponse.json({
      connected: true,
      available: mapBuckets(balance?.available),
      pending: mapBuckets(balance?.pending),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch balance'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
