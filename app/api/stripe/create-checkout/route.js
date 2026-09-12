import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    const priceId = process.env.STRIPE_LIFETIME_PRICE_ID

    if (!secretKey || !priceId) {
      return NextResponse.json(
        { error: 'Stripe not configured. Missing STRIPE_SECRET_KEY or STRIPE_LIFETIME_PRICE_ID.' },
        { status: 500 }
      )
    }

    const stripe = new Stripe(secretKey)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
    }

    // Block duplicate purchases
    const { data: paid } = await supabase
      .from('sr_paid_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (paid) {
      return NextResponse.json(
        { error: 'You already have lifetime access.' },
        { status: 400 }
      )
    }

    // Determine origin from the incoming request (works on localhost + Render + Vercel)
    const url = new URL(request.url)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${url.protocol}//${url.host}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      success_url: `${origin}/dashboard/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?purchase=cancelled`,
      metadata: { user_id: user.id },
      client_reference_id: user.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Checkout failed'
    console.error('[CHECKOUT]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
