import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

// Find the user's active Stripe subscription, preferring the stored id and
// falling back to a lookup by customer email.
async function resolveSubscriptionId(stripe, subscriptionRow, userEmail) {
  if (subscriptionRow?.stripe_subscription_id) {
    return subscriptionRow.stripe_subscription_id
  }

  if (subscriptionRow?.stripe_customer_id) {
    const subs = await stripe.subscriptions.list({
      customer: subscriptionRow.stripe_customer_id,
      status: 'active',
      limit: 1,
    })
    if (subs.data.length > 0) {
      return subs.data[0].id
    }
  }

  if (userEmail) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 })
    if (customers.data.length > 0) {
      const subs = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: 'active',
        limit: 1,
      })
      if (subs.data.length > 0) {
        return subs.data[0].id
      }
    }
  }

  return null
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
    }

    const user = authData.user

    const { data: subscriptionRow } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const stripe = getStripe()
    const subscriptionId = await resolveSubscriptionId(stripe, subscriptionRow, user.email)

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription was found to cancel.' },
        { status: 404 },
      )
    }

    // Cancel at period end so the user keeps access until the paid period ends.
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: updated?.current_period_end
        ? new Date(updated.current_period_end * 1000).toISOString().split('T')[0]
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 },
    )
  }
}
