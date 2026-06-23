import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import {
  createAdminClient,
  resolvePlanFromPriceId,
  upsertSubscriptionRecord,
} from '@/lib/subscriptions/store'
import { sendSubscriptionEmail } from '@/lib/email/subscriptionEmails'

function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

function formatPeriodEnd(periodEnd) {
  if (!periodEnd) return null
  try {
    return new Date(periodEnd * 1000).toISOString().split('T')[0]
  } catch {
    return null
  }
}

// Resolve the recipient email for a Stripe customer.
async function resolveCustomerEmail(stripe, customerId, fallback) {
  if (fallback) return fallback
  if (!customerId) return null
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer && !customer.deleted) {
      return customer.email || null
    }
  } catch {
    // ignore retrieval errors
  }
  return null
}

// Resolve the friendly plan name from a Stripe subscription object.
function resolvePlanFromSubscription(subscription) {
  const priceId = subscription?.items?.data?.[0]?.price?.id
  return resolvePlanFromPriceId(priceId) || subscription?.metadata?.plan || null
}

async function handleSubscriptionUpdated(stripe, supabase, subscription) {
  const userId = subscription?.metadata?.userId || null
  const planName = resolvePlanFromSubscription(subscription)
  const status = subscription?.status || null
  const periodEnd = formatPeriodEnd(subscription?.current_period_end)

  const fields = {
    status,
    stripe_customer_id: subscription?.customer || null,
    stripe_subscription_id: subscription?.id || null,
    cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
    current_period_end: periodEnd,
  }
  if (planName) {
    fields.plan = planName
  }

  await upsertSubscriptionRecord(
    supabase,
    { userId, stripeSubscriptionId: subscription?.id },
    fields,
  )

  // Notify the customer the first time a subscription becomes active.
  if (status === 'active') {
    const email = await resolveCustomerEmail(stripe, subscription?.customer)
    if (email) {
      await sendSubscriptionEmail('active', email, { planName })
    }
  }
}

async function handleSubscriptionDeleted(stripe, supabase, subscription) {
  const userId = subscription?.metadata?.userId || null
  const planName = resolvePlanFromSubscription(subscription)
  const periodEnd = formatPeriodEnd(subscription?.current_period_end)

  await upsertSubscriptionRecord(
    supabase,
    { userId, stripeSubscriptionId: subscription?.id },
    {
      status: 'canceled',
      plan: 'Free',
      cancel_at_period_end: false,
      stripe_subscription_id: subscription?.id || null,
      current_period_end: periodEnd,
    },
  )

  const email = await resolveCustomerEmail(stripe, subscription?.customer)
  if (email) {
    await sendSubscriptionEmail('canceled', email, { planName, periodEnd })
  }
}

async function handleInvoicePaymentSucceeded(stripe, supabase, invoice) {
  const subscriptionId = invoice?.subscription
  // One-off invoice payments are not subscription renewals.
  if (!subscriptionId) {
    return
  }

  let subscription = null
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch {
    // ignore retrieval errors
  }

  const userId = subscription?.metadata?.userId || null
  const planName = subscription
    ? resolvePlanFromSubscription(subscription)
    : resolvePlanFromPriceId(invoice?.lines?.data?.[0]?.price?.id)
  const periodEnd = formatPeriodEnd(subscription?.current_period_end)

  await upsertSubscriptionRecord(
    supabase,
    { userId, stripeSubscriptionId: subscriptionId },
    {
      status: 'active',
      stripe_customer_id: invoice?.customer || null,
      stripe_subscription_id: subscriptionId,
      current_period_end: periodEnd,
      ...(planName ? { plan: planName } : {}),
    },
  )

  const email = await resolveCustomerEmail(stripe, invoice?.customer, invoice?.customer_email)
  if (email) {
    // billing_reason "subscription_create" is the first invoice (activation),
    // any later cycle is a renewal.
    const isRenewal = invoice?.billing_reason !== 'subscription_create'
    await sendSubscriptionEmail(isRenewal ? 'renewal' : 'active', email, {
      planName,
      amount: invoice?.amount_paid ? invoice.amount_paid / 100 : null,
      currency: invoice?.currency,
    })
  }
}

async function handleInvoicePaymentFailed(stripe, supabase, invoice) {
  const subscriptionId = invoice?.subscription
  if (!subscriptionId) {
    return
  }

  let subscription = null
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch {
    // ignore retrieval errors
  }

  const userId = subscription?.metadata?.userId || null
  const planName = subscription ? resolvePlanFromSubscription(subscription) : null

  await upsertSubscriptionRecord(
    supabase,
    { userId, stripeSubscriptionId: subscriptionId },
    {
      status: 'past_due',
      stripe_customer_id: invoice?.customer || null,
      stripe_subscription_id: subscriptionId,
    },
  )

  const email = await resolveCustomerEmail(stripe, invoice?.customer, invoice?.customer_email)
  if (email) {
    await sendSubscriptionEmail('payment_failed', email, { planName })
  }
}

export async function POST(request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })
    }

    const stripe = getStripe()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const rawBody = await request.text()
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const invoiceId = session.metadata?.invoiceId

        if (invoiceId) {
          const supabase = await createClient()
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const supabase = createAdminClient()
        await handleSubscriptionUpdated(stripe, supabase, event.data.object)
        break
      }

      case 'customer.subscription.deleted': {
        const supabase = createAdminClient()
        await handleSubscriptionDeleted(stripe, supabase, event.data.object)
        break
      }

      case 'invoice.payment_succeeded': {
        const supabase = createAdminClient()
        await handleInvoicePaymentSucceeded(stripe, supabase, event.data.object)
        break
      }

      case 'invoice.payment_failed': {
        const supabase = createAdminClient()
        await handleInvoicePaymentFailed(stripe, supabase, event.data.object)
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 400 },
    )
  }
}
