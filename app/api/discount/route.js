import { NextResponse } from 'next/server'

// Server-side discount rules. Codes are validated here so the client cannot
// fabricate a discount. Keeping this self-contained avoids requiring Stripe
// coupon configuration for the basic promo codes shown in the UI.
const DISCOUNTS = {
  WELCOME10: { code: 'WELCOME10', type: 'percentage', value: 10 },
  SAVE20: { code: 'SAVE20', type: 'percentage', value: 20 },
  LAUNCH25: { code: 'LAUNCH25', type: 'percentage', value: 25 },
}

function computeAmount(discount, subtotal) {
  const base = Number(subtotal)
  if (!Number.isFinite(base) || base <= 0) return 0
  if (discount.type === 'percentage') {
    return Math.round(base * (discount.value / 100) * 100) / 100
  }
  return Math.min(base, discount.value)
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
    const subtotal = Number(body?.subtotal) || 0

    if (!code) {
      return NextResponse.json({ success: false, error: 'Discount code is required' }, { status: 400 })
    }

    const discount = DISCOUNTS[code]
    if (!discount) {
      return NextResponse.json({ success: false, error: 'Invalid discount code' }, { status: 200 })
    }

    const discountAmount = computeAmount(discount, subtotal)
    const newTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)

    return NextResponse.json({
      success: true,
      discount,
      discountAmount,
      newTotal,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to apply discount' },
      { status: 500 },
    )
  }
}
