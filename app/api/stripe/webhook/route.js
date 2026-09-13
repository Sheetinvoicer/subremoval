import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(secretKey)

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    if (!webhookSecret) {
      // In production this should never happen. Refuse rather than trust unverified events.
      if (process.env.NODE_ENV === 'production') {
        console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not configured in production — refusing to process')
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
      }
      // Dev fallback only — parse directly
      event = JSON.parse(body)
    } else {
      if (!signature) {
        console.error('[WEBHOOK] Missing stripe-signature header')
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
      }
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[WEBHOOK] Signature failed:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    // Only process one-time payments
    if (session.mode !== 'payment') {
      return NextResponse.json({ ok: true, skipped: 'not a payment mode' })
    }

    const userId = session.metadata?.user_id || session.client_reference_id

    if (!userId) {
      console.error('[WEBHOOK] No user_id in session metadata')
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[WEBHOOK] Missing Supabase admin env')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { error } = await admin.from('sr_paid_users').upsert({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_customer_email: session.customer_details?.email ?? session.customer_email ?? null,
      paid_at: new Date().toISOString(),
      lifetime: true,
    }, { onConflict: 'user_id' })

    if (error) {
      console.error('[WEBHOOK] Insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[WEBHOOK] User marked as paid:', userId)
  }

  return NextResponse.json({ received: true })
}
