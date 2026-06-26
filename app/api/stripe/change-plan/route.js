import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import {
  getPlan,
  isContactSales,
  isSelfServe,
  normalizePlanName,
  resolvePlanFromPriceId,
  resolvePriceId,
} from '@/lib/subscriptions/plans'

function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

// Find the user's active Stripe subscription, preferring the stored id and
// falling back to a lookup by stored customer id or email.
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
    if (subs.data.length > 0) return subs.data[0].id
  }

  if (userEmail) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 })
    if (customers.data.length > 0) {
      const subs = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: 'active',
        limit: 1,
      })
      if (subs.data.length > 0) return subs.data[0].id
    }
  }

  return null
}

/**
 * Change an existing subscriber's plan with proration.
 *
 * Switches between self-serve tiers (Pro <-> Business) by updating the Stripe
 * subscription's price in place. Proration is always immediate
 * (`create_prorations`): upgrades charge the prorated difference now and
 * downgrades credit unused time toward the next invoice.
 *
 * - Enterprise targets are rejected (contact sales).
 * - Free targets are rejected (use cancel-subscription instead).
 * - Users without an active subscription are told to use checkout
 *   (create-subscription) so a new subscription is created.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const targetPlan = normalizePlanName(body?.plan)

    if (isContactSales(targetPlan)) {
      return NextResponse.json(
        { error: 'Enterprise is sales-assisted. Please contact sales.', action: 'contact_sales' },
        { status: 400 },
      )
    }

    if (!isSelfServe(targetPlan)) {
      // Free (or anything non self-serve) — downgrading to Free means cancelling.
      return NextResponse.json(
        { error: 'To move to the Free plan, cancel your subscription instead.', action: 'cancel' },
        { status: 400 },
      )
    }

    const targetPriceId = resolvePriceId(targetPlan)
    if (!targetPriceId) {
      return NextResponse.json(
        { error: `No Stripe price is configured for the ${targetPlan} plan.` },
        { status: 400 },
      )
    }

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
      // No subscription to modify — caller should start a fresh checkout.
      return NextResponse.json(
        { error: 'No active subscription found. Start a new checkout instead.', action: 'checkout' },
        { status: 409 },
      )
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const item = subscription?.items?.data?.[0]
    if (!item?.id) {
      return NextResponse.json(
        { error: 'Subscription has no billable item to update.' },
        { status: 422 },
      )
    }

    const currentPlan = resolvePlanFromPriceId(item?.price?.id) || 'Free'
    if (normalizePlanName(currentPlan) === targetPlan) {
      return NextResponse.json({ success: true, plan: targetPlan, changed: false })
    }

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: targetPriceId }],
      proration_behavior: 'create_prorations',
      metadata: { ...(subscription.metadata || {}), plan: targetPlan, userId: user.id },
    })

    // Eagerly reflect the new plan; the webhook also syncs on
    // customer.subscription.updated.
    await supabase
      .from('subscriptions')
      .update({
        plan: targetPlan,
        stripe_subscription_id: subscriptionId,
        cancel_at_period_end: Boolean(updated?.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      changed: true,
      plan: targetPlan,
      previousPlan: normalizePlanName(currentPlan),
      prorated: true,
      label: getPlan(targetPlan).name,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to change plan' },
      { status: 500 },
    )
  }
}
