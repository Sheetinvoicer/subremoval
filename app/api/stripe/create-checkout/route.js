import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

function toStripeAmount(amount) {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null
  }

  return Math.round(numericAmount * 100)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      invoiceId,
      invoiceNumber,
      amount,
      clientName,
      clientEmail,
      successUrl,
      cancelUrl,
      returnUrl,
      currency = 'usd',
    } = body || {}

    if (!invoiceId || !invoiceNumber) {
      return NextResponse.json({ error: 'invoiceId and invoiceNumber are required' }, { status: 400 })
    }

    const stripeAmount = toStripeAmount(amount)
    if (!stripeAmount) {
      return NextResponse.json({ error: 'Valid invoice amount is required' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const normalizedSuccessUrl = successUrl || `${appUrl}/pay/${invoiceId}?status=success`
    const normalizedCancelUrl = cancelUrl || returnUrl || `${appUrl}/pay/${invoiceId}?status=cancel`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: clientEmail || undefined,
      success_url: normalizedSuccessUrl,
      cancel_url: normalizedCancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(currency || 'usd').toLowerCase(),
            unit_amount: stripeAmount,
            product_data: {
              name: `Invoice ${invoiceNumber}`,
              description: clientName ? `Payment for ${clientName}` : undefined,
            },
          },
        },
      ],
      metadata: {
        invoiceId,
        invoiceNumber,
      },
      payment_intent_data: {
        metadata: {
          invoiceId,
          invoiceNumber,
        },
      },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 },
    )
  }
}