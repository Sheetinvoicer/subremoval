import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'

export const dynamic = 'force-dynamic'

// Admin-only feed of recorded user actions. Supports optional filtering by
// action and actor so admins can drill into a specific user's activity.
export async function GET(req) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const params = new URL(req.url).searchParams
  const limit = Math.min(Number(params.get('limit') || 100), 500)
  const action = params.get('action')
  const userId = params.get('userId')

  const supabase = await createClient()
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (action) {
    query = query.eq('action', action)
  }
  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data || [] })
}
