import { NextResponse } from 'next/server'
import { getCurrentUserRole } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// Returns the effective role for the current user, applying the same
// email-based admin bootstrap used by the middleware and admin APIs. Client
// components (RoleGuard, Sidebar) rely on this so their view of the role stays
// consistent with server-side access control.
export async function GET() {
  const { role, error } = await getCurrentUserRole()

  if (error || !role) {
    return NextResponse.json({ role: null, authenticated: false }, { status: 200 })
  }

  return NextResponse.json({ role, authenticated: true })
}
