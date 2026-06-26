import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity } from '@/lib/entity'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → current emergency-stop state.
export async function GET() {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const entity = createEntity({ actor: actorFromUser(access.user) })
    return NextResponse.json({ emergencyStopped: await entity.safety.isEmergencyStopped() })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to read emergency stop')
  }
}

// POST → engage/release the global emergency stop. While engaged, no proposal
// can be created, approved, or executed. Releasing always works.
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const engaged = body?.engaged === true || body?.engaged === 'true'
    const entity = createEntity({ actor: actorFromUser(access.user) })
    await entity.safety.setEmergencyStop(engaged)
    return NextResponse.json({ emergencyStopped: engaged })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to update emergency stop')
  }
}
