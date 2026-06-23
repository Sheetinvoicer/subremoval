import { NextResponse } from 'next/server'

// Simple, configurable tax rates by country (and a few US states). This keeps
// tax calculation working without requiring Stripe Tax to be configured. Rates
// are percentages.
const COUNTRY_RATES = {
  US: 0,
  GB: 20,
  DE: 19,
  FR: 20,
  IT: 22,
  ES: 21,
  CA: 5,
  AU: 10,
  AE: 5,
}

const US_STATE_RATES = {
  CA: 7.25,
  NY: 4,
  TX: 6.25,
  FL: 6,
  WA: 6.5,
}

function resolveRate(country, state) {
  const normalizedCountry = String(country || 'US').toUpperCase()
  if (normalizedCountry === 'US' && state) {
    const normalizedState = String(state).toUpperCase()
    if (US_STATE_RATES[normalizedState] != null) {
      return US_STATE_RATES[normalizedState]
    }
  }
  return COUNTRY_RATES[normalizedCountry] ?? 0
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const amount = Number(body?.amount)
    const country = body?.country || 'US'
    const state = body?.state

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Valid amount is required' }, { status: 400 })
    }

    const rate = resolveRate(country, state)
    const taxAmount = Math.round(amount * (rate / 100) * 100) / 100
    const totalAmount = Math.round((amount + taxAmount) * 100) / 100

    return NextResponse.json({
      success: true,
      taxRate: { rate, country: String(country).toUpperCase(), state: state || null },
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to calculate tax' },
      { status: 500 },
    )
  }
}
