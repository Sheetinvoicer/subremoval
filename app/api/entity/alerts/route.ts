import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity, detectIssues } from '@/lib/entity'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'
import type { EntityAlert } from '@/lib/entity/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → list the most recent alerts for the dashboard (admin only).
export async function GET() {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const entity = createEntity({ actor: actorFromUser(access.user) })
    const alerts = await entity.store.listAlerts({ limit: 100 })
    return NextResponse.json({ alerts })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to load alerts')
  }
}

type AlertOp = 'scan' | 'acknowledge' | 'dismiss'

// POST → run a detection scan, or acknowledge/dismiss a single alert.
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const op = body?.op as AlertOp | undefined
    const actor = actorFromUser(access.user)
    const entity = createEntity({ actor })

    if (op === 'scan') {
      const summary = await detectIssues(entity)
      await notifyCriticalAlerts(summary.alerts)
      const alerts = await entity.store.listAlerts({ limit: 100 })
      return NextResponse.json({ summary, alerts })
    }

    if (op === 'acknowledge' || op === 'dismiss') {
      const alertId = typeof body?.alertId === 'string' ? body.alertId : ''
      if (!alertId) {
        return NextResponse.json({ error: 'An alertId is required.' }, { status: 400 })
      }
      const status = op === 'acknowledge' ? 'acknowledged' : 'dismissed'
      const alert = await entity.store.updateAlert(alertId, {
        status,
        updatedAt: new Date().toISOString(),
      })
      await entity.store.recordAudit({
        action: op === 'acknowledge' ? 'entity.alert_acknowledged' : 'entity.alert_dismissed',
        actor,
        resourceType: 'entity_alert',
        resourceId: alertId,
      })
      return NextResponse.json({ alert })
    }

    return NextResponse.json({ error: `Unknown op: ${String(op)}` }, { status: 400 })
  } catch (error) {
    return entityErrorResponse(error, 'Failed to update alert')
  }
}

/**
 * Best-effort email for newly-detected critical alerts. Skipped silently unless
 * both `RESEND_API_KEY` and `ENTITY_ALERT_EMAIL` are configured, and never
 * allowed to fail the request — exactly like the other optional integrations.
 */
async function notifyCriticalAlerts(alerts: EntityAlert[]): Promise<void> {
  const critical = alerts.filter((a) => a.severity === 'critical')
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ENTITY_ALERT_EMAIL
  if (critical.length === 0 || !apiKey || !to) return

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sheetinvoicer.com'
    await resend.emails.send({
      from: 'SheetInvoicer Entity <noreply@sheetinvoicer.com>',
      to: [to],
      subject: `Entity: ${critical.length} critical alert${critical.length > 1 ? 's' : ''} detected`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Critical alerts detected</h2>
          <ul>
            ${critical
              .map((a) => `<li><strong>${escapeHtml(a.title)}</strong> — ${a.source}</li>`)
              .join('')}
          </ul>
          <a href="${appUrl}/dashboard/entity"
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Review in the Entity dashboard
          </a>
        </div>
      `,
    })
  } catch (err) {
    console.error('Entity alert email failed:', err)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
