import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { restoreBackup } from '@/lib/backup/manager'
import { recordAuditLog, AUDIT_ACTIONS } from '@/lib/audit/log'

export async function POST(req) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = await req.json().catch(() => null)
  if (!body?.backupId) {
    return NextResponse.json({ error: 'backupId is required' }, { status: 400 })
  }

  try {
    const result = await restoreBackup(body.backupId)
    await recordAuditLog({
      action: AUDIT_ACTIONS.BACKUP_RESTORED,
      actor: access.user,
      resourceType: 'backup',
      resourceId: body.backupId,
      request: req,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Restore failed' }, { status: 500 })
  }
}
