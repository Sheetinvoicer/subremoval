import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import Stripe from 'stripe'

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

// The Connect platform's OAuth client id (starts with `ca_`). It identifies the
// platform application that the user is connecting their bank/account to.
function getConnectClientId() {
  return (
    process.env.STRIPE_CONNECT_CLIENT_ID ||
    process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID ||
    null
  )
}

const STATE_COOKIE = 'stripe_connect_state'

export async function POST(request) {
  try {
    const clientId = getConnectClientId()
    if (!clientId) {
      return NextResponse.json(
        {
          error:
            'Stripe Connect is not configured. Set STRIPE_CONNECT_CLIENT_ID to enable bank connection.',
        },
        { status: 400 },
      )
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const redirectUri = `${appUrl}/api/stripe/connect/callback`

    // A random, single-use value tying the redirect back to this browser so the
    // callback can reject forged/replayed OAuth responses (CSRF protection).
    const state = randomBytes(16).toString('hex')

    const url = stripe.oauth.authorizeUrl({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: redirectUri,
      state,
    })

    const response = NextResponse.json({ url })
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start bank connection' },
      { status: 500 },
    )
  }
}
