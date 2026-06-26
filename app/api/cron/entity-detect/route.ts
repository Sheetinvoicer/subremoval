import { NextRequest, NextResponse } from 'next/server'
import { createEntity, detectIssues } from '@/lib/entity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Scheduled issue detection. Polls the configured monitoring providers
 * (Sentry/Vercel/performance), raises de-duplicated `entity_alerts`, and files
 * AI `healing.fix` proposals for high-confidence issues — all of which a human
 * still has to approve and apply. Nothing is deployed here.
 *
 * Protected by the same `CRON_SECRET` bearer token as the other cron routes
 * (see app/api/cron/send-reminders/route.tsx).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const entity = createEntity({ actor: { id: null, email: 'entity-cron' } })
    const summary = await detectIssues(entity)
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Entity detection cron failed:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
