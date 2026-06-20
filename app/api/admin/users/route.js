import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ROLES, normalizeRole } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data || [] })
}

export async function PATCH(request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = await request.json().catch(() => null)
  const targetUserId = body?.userId
  const targetRole = normalizeRole(body?.role)

  if (!targetUserId || !body?.role) {
    return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
  }

  if (!Object.values(ROLES).includes(targetRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (targetUserId === access.user.id && targetRole !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Cannot downgrade your own admin role' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .update({ role: targetRole })
    .eq('id', targetUserId)
    .select('id, email, full_name, role')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}
