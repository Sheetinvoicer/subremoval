import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.action === 'cancel') {
    updates.status = 'cancelled'
    updates.cancelled_at = new Date().toISOString()
  } else if (body.action === 'dismiss') {
    updates.status = 'dismissed'
    const { data: sub } = await supabase
      .from('sr_detected_subscriptions')
      .select('domain')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sub?.domain) {
      await supabase.from('sr_user_excluded_domains').insert({ user_id: user.id, domain: sub.domain })
    }
  } else if (body.action === 'reactivate') {
    updates.status = 'active'
    updates.cancelled_at = null
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { error } = await supabase
    .from('sr_detected_subscriptions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
