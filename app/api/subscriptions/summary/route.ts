import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FX: Record<string, number> = { USD: 1, EUR: 1.085, GBP: 1.27 }
const toUSD = (a: number | null, c: string | null) => (a == null ? 0 : a * (FX[c ?? 'USD'] ?? 1))

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: subs } = await supabase
    .from('sr_detected_subscriptions')
    .select('*')
    .eq('user_id', user.id)

  const all = subs ?? []
  const active = all.filter((s) => s.status === 'active')
  const cancelled = all.filter((s) => s.status === 'cancelled')

  const monthlySpend = active
    .filter((s) => s.confidence !== 'low')
    .reduce((sum, s) => sum + toUSD(s.amount, s.currency), 0)

  const monthlySaved = cancelled.reduce((sum, s) => sum + toUSD(s.amount, s.currency), 0)

  const lifetimeSaved = cancelled.reduce((sum, s) => {
    if (!s.cancelled_at || s.amount == null) return sum
    const months = Math.max(1, Math.floor((Date.now() - new Date(s.cancelled_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    return sum + toUSD(s.amount, s.currency) * months
  }, 0)

  return NextResponse.json({
    monthlySpend: Number(monthlySpend.toFixed(2)),
    monthlySaved: Number(monthlySaved.toFixed(2)),
    lifetimeSaved: Number(lifetimeSaved.toFixed(2)),
    activeCount: active.length,
    cancelledCount: cancelled.length,
    needsReview: active.filter((s) => s.confidence !== 'high').length,
  })
}
