import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { askAdminAI } from '@/lib/ai/admin'
import { adminAiErrorResponse } from '@/lib/ai/route-helpers'

// This route reads SUPABASE_SERVICE_ROLE_KEY and calls the Supabase and Anthropic/
// OpenAI Node SDKs, so pin the Node.js runtime (never Edge) and force dynamic so
// the service-role data is always read fresh per request.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin-only AI chat for user-data queries. Reuses the shared admin guard so only
// admins can interrogate platform-wide data.
export async function POST(request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = await request.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  // Sanitise client-supplied history into the {role, content} shape the lib
  // expects, and cap it so the prompt can't grow unbounded.
  const history = Array.isArray(body?.history)
    ? body.history
        .filter(
          (turn) =>
            turn &&
            (turn.role === 'user' || turn.role === 'assistant') &&
            typeof turn.content === 'string'
        )
        .slice(-10)
        .map((turn) => ({ role: turn.role, content: turn.content }))
    : []

  try {
    const response = await askAdminAI(message, history)
    return NextResponse.json({ response })
  } catch (error) {
    return adminAiErrorResponse(error, 'Failed to process admin AI chat')
  }
}
