import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { gatherAdminContext, buildRecommendations, generateAiTips } from '@/lib/ai/admin'
import { adminAiErrorResponse } from '@/lib/ai/route-helpers'

// This route reads SUPABASE_SERVICE_ROLE_KEY and calls the Supabase and Anthropic/
// OpenAI Node SDKs, so pin the Node.js runtime (never Edge) and force dynamic so
// the service-role data is always read fresh per request.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → smart recommendations: role suggestions based on usage, feature
// recommendations and invoice-optimisation tips (all deterministic). Pass
// `?ai=1` to additionally include an AI-written tips section (best-effort).
export async function GET(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const ctx = await gatherAdminContext()
    const recommendations = buildRecommendations(ctx)

    const wantAi = new URL(request.url).searchParams.get('ai') === '1'
    if (wantAi) {
      try {
        recommendations.aiTips = await generateAiTips(ctx)
      } catch (error) {
        // AI enrichment is optional; the deterministic recommendations still ship.
        console.error('AI tips generation failed:', error)
      }
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    return adminAiErrorResponse(error, 'Failed to load recommendations')
  }
}
