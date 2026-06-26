import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity } from '@/lib/entity'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → analyse a reported error and file an AI fix PROPOSAL for review.
// No code is ever changed or deployed; "applying" a fix stays a human action.
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'An error title is required.' }, { status: 400 })
    }

    const entity = createEntity({ actor: actorFromUser(access.user) })
    const occurrences = Number(body?.occurrences)
    const action = await entity.selfHealing.analyze({
      title,
      message: typeof body?.message === 'string' ? body.message : undefined,
      stack: typeof body?.stack === 'string' ? body.stack : undefined,
      occurrences: Number.isFinite(occurrences) && occurrences > 0 ? occurrences : 1,
      source: typeof body?.source === 'string' ? body.source : 'manual',
    })

    return NextResponse.json({ action })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to analyze error')
  }
}
