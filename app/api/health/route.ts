import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { getAdminAiHealth } from '@/lib/ai/admin'

// Reads process.env and (optionally) hits Supabase with the service-role key, so
// pin the Node.js runtime (never Edge) and force dynamic so the check is never
// statically cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/health → lightweight readiness/liveness probe.
//
// By default it only reports whether the required env vars are *present* (never
// their values), so it is safe to expose publicly to uptime monitors. Pass
// `?probe=1` to additionally run a live Supabase check that validates the
// service-role key — this is gated behind an admin session because it reveals
// backend connectivity detail and does real work.
export async function GET(request: Request) {
  try {
    const wantProbe = new URL(request.url).searchParams.get('probe') === '1'

    let probe = false
    if (wantProbe) {
      const access = await requireRole(ROLES.ADMIN)
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
      probe = true
    }

    const health = await getAdminAiHealth({ probe })

    // 200 when healthy or merely degraded (deterministic analytics still work);
    // 503 only on a hard mis-configuration so uptime monitors can alert on it.
    const httpStatus = health.status === 'error' ? 503 : 200
    return NextResponse.json(health, { status: httpStatus })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Health check failed'
    return NextResponse.json(
      { ok: false, status: 'error', error: messageText, checkedAt: new Date().toISOString() },
      { status: 503 }
    )
  }
}
