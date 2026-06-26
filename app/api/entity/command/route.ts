import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity } from '@/lib/entity'
import { actorFromUser, entityErrorResponse, newId } from '@/lib/entity/route-helpers'

// Reads the service-role key and calls Supabase + the AI SDKs, so pin Node.js
// (never Edge) and force dynamic so each request plans fresh.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → turn a high-level goal into a plan of proposed tasks. The plan is
// recorded; no task runs until a human approves the resulting action(s).
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const goal = typeof body?.goal === 'string' ? body.goal.trim() : ''
    if (!goal) {
      return NextResponse.json({ error: 'A goal is required.' }, { status: 400 })
    }

    const actor = actorFromUser(access.user)
    const entity = createEntity({ actor })

    if (await entity.safety.isEmergencyStopped()) {
      return NextResponse.json(
        { error: 'The entity is under an emergency stop.', code: 'ENTITY_STOPPED' },
        { status: 423 },
      )
    }

    const plan = await entity.commander.planGoal(goal)
    const command = await entity.store.insertCommand({
      id: newId('cmd'),
      goal,
      summary: plan.summary,
      plan,
      status: 'planned',
      createdBy: actor,
      createdAt: new Date().toISOString(),
    })

    await entity.store.recordAudit({
      action: 'entity.command_created',
      actor,
      resourceType: 'entity_command',
      resourceId: command.id,
      metadata: { goal, taskCount: plan.tasks.length },
    })

    return NextResponse.json({ command, plan })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to create command')
  }
}
