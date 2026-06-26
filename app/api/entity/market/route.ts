import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity } from '@/lib/entity'
import type { MarketingChannel } from '@/lib/entity/marketing'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_CHANNELS: readonly string[] = ['blog', 'twitter', 'linkedin', 'instagram', 'email']

// POST → generate a marketing content DRAFT and file it for review. The draft
// is never published automatically; posting is a separate, human-approved step.
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const channel = typeof body?.channel === 'string' ? body.channel : ''
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
    if (!topic) {
      return NextResponse.json({ error: 'A topic is required.' }, { status: 400 })
    }
    if (!ALLOWED_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `Channel must be one of: ${ALLOWED_CHANNELS.join(', ')}.` },
        { status: 400 },
      )
    }

    const entity = createEntity({ actor: actorFromUser(access.user) })
    const action = await entity.marketing.generateDraft({
      channel: channel as MarketingChannel,
      topic,
      audience: typeof body?.audience === 'string' ? body.audience : undefined,
      tone: typeof body?.tone === 'string' ? body.tone : undefined,
    })

    return NextResponse.json({ action })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to generate marketing draft')
  }
}
