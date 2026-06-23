import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

// Map a friendly plan name to a configured Stripe price ID via env vars.
function resolvePriceId(planName) {
  if (!planName) return null
  const normalized = String(planName).toLowerCase()
  const map = {
    pro: process.env.STRIPE_PRO_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    business:
      process.env.STRIPE_BUSINESS_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID,
  }
  return map[normalized] || null
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { plan, priceId: rawPriceId, customerEmail, successUrl, cancelUrl } = body || {}

    const priceId = rawPriceId || resolvePriceId(plan)

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            'No Stripe price is configured for this plan. Set STRIPE_PRO_PRICE_ID / STRIPE_BUSINESS_PRICE_ID.',
        },
        { status: 400 },
      )
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const normalizedSuccessUrl = successUrl || `${appUrl}/dashboard?subscription=success`
    const normalizedCancelUrl = cancelUrl || `${appUrl}/pricing?subscription=cancel`

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail || undefined,
      success_url: normalizedSuccessUrl,
      cancel_url: normalizedCancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        plan: plan || '',
      },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription session' },
      { status: 500 },
    )
  }
}
