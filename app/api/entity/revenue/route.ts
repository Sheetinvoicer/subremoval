import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity } from '@/lib/entity'
import type { RevenueMetrics } from '@/lib/entity/revenue'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const METRIC_KEYS: (keyof RevenueMetrics)[] = [
  'mrr',
  'activeSubscriptions',
  'newCustomers30d',
  'churnedCustomers30d',
  'totalRevenue',
  'pendingRevenue',
  'overdueInvoices',
]

function metricsFromParams(params: URLSearchParams): RevenueMetrics {
  const metrics: RevenueMetrics = {}
  for (const key of METRIC_KEYS) {
    const raw = params.get(key)
    if (raw == null) continue
    const value = Number(raw)
    if (Number.isFinite(value)) metrics[key] = value
  }
  return metrics
}

function metricsFromBody(body: unknown): RevenueMetrics {
  const source = (body && typeof body === 'object' ? (body as Record<string, unknown>) : {})
  const nested = source.metrics && typeof source.metrics === 'object' ? (source.metrics as Record<string, unknown>) : source
  const metrics: RevenueMetrics = {}
  for (const key of METRIC_KEYS) {
    const value = Number(nested[key])
    if (Number.isFinite(value)) metrics[key] = value
  }
  return metrics
}

// GET → a deterministic revenue report from the supplied metrics (query params).
export async function GET(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const entity = createEntity({ actor: actorFromUser(access.user) })
    const metrics = metricsFromParams(new URL(request.url).searchParams)
    const report = entity.revenue.analyze(metrics)
    return NextResponse.json({ report })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to build revenue report')
  }
}

// POST → analyse metrics and file an AI revenue RECOMMENDATION for review.
// Nothing is priced or billed automatically.
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const entity = createEntity({ actor: actorFromUser(access.user) })
    const report = entity.revenue.analyze(metricsFromBody(body))
    const action = await entity.revenue.recommend(report)
    return NextResponse.json({ report, action })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to generate revenue recommendation')
  }
}
