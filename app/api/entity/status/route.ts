import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity, getEntityStatus } from '@/lib/entity'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → a snapshot of the entity: emergency-stop state, pending approvals,
// recent actions and recent commands. Used by the dashboard.
export async function GET() {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const entity = createEntity({ actor: actorFromUser(access.user) })
    const status = await getEntityStatus(entity)
    return NextResponse.json({ status })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to load entity status')
  }
}
