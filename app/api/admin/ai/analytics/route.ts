import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import {
  gatherAdminContext,
  computeMetrics,
  analyzeActivity,
  detectAnomalies,
  generateAdminReport,
} from '@/lib/ai/admin'
import { adminAiErrorResponse } from '@/lib/ai/route-helpers'

// This route reads SUPABASE_SERVICE_ROLE_KEY and calls the Supabase and Anthropic/
// OpenAI Node SDKs, so pin the Node.js runtime (never Edge) and force dynamic so
// the service-role data is always read fresh per request.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → the usage-insights dashboard payload. This is deterministic and makes no
// model call, so it stays fast: platform metrics, user-activity analysis and
// auto-flagged anomaly alerts.
export async function GET() {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const ctx = await gatherAdminContext()
    return NextResponse.json({
      generatedAt: ctx.generatedAt,
      metrics: computeMetrics(ctx),
      activity: analyzeActivity(ctx, 30),
      anomalies: detectAnomalies(ctx),
    })
  } catch (error) {
    return adminAiErrorResponse(error, 'Failed to load admin analytics')
  }
}

// POST → auto-generate an AI administrator report from the same platform context.
export async function POST() {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const report = await generateAdminReport()
    return NextResponse.json({ report })
  } catch (error) {
    return adminAiErrorResponse(error, 'Failed to generate admin report')
  }
}
