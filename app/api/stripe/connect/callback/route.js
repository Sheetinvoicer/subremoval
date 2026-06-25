import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(stripeSecretKey)
}

const STATE_COOKIE = 'stripe_connect_state'
const ACCOUNT_COOKIE = 'stripe_connect_account'

export async function GET(request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const settingsUrl = `${appUrl}/dashboard/settings`

  // Always clear the single-use state cookie when leaving this handler.
  const clearState = (response) => {
    response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    // The user denied access on Stripe, or Stripe reported an error.
    if (oauthError) {
      return clearState(NextResponse.redirect(`${settingsUrl}?bank=error`))
    }

    // Validate the CSRF state against the cookie set when the flow started.
    const storedState = request.cookies.get(STATE_COOKIE)?.value
    if (!code || !state || !storedState || state !== storedState) {
      return clearState(NextResponse.redirect(`${settingsUrl}?bank=error`))
    }

    const stripe = getStripeClient()
    const tokenResponse = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    const connectedAccountId = tokenResponse?.stripe_user_id
    if (!connectedAccountId) {
      return clearState(NextResponse.redirect(`${settingsUrl}?bank=error`))
    }

    const response = clearState(NextResponse.redirect(`${settingsUrl}?bank=connected`))
    // Record a lightweight, readable flag so the settings UI can reflect the
    // connected state across reloads. It is not security-sensitive.
    response.cookies.set(ACCOUNT_COOKIE, connectedAccountId, {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })

    return response
  } catch (error) {
    return clearState(NextResponse.redirect(`${settingsUrl}?bank=error`))
  }
}
