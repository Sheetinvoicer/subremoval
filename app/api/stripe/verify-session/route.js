import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const stripe = new Stripe(secretKey)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { ok: false, error: 'Payment not completed' },
        { status: 400 }
      )
    }

    const userId = session.metadata?.user_id || session.client_reference_id
    if (!userId) {
      console.error('[VERIFY] Session missing user_id', {
        sessionId: session.id,
        customerEmail: session.customer_details?.email || session.customer_email,
        amount: session.amount_total,
        metadata: session.metadata,
      })
      return NextResponse.json({ error: 'Missing user_id in session' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
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
      console.error('[VERIFY] Insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[VERIFY] User marked as paid:', {
      userId,
      sessionId: session.id,
      email: session.customer_details?.email || session.customer_email,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Verification failed'
    console.error('[VERIFY]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
