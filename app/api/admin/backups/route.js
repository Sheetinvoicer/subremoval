import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createBackup, pruneExpiredBackups } from '@/lib/backup/manager'
import { recordAuditLog, AUDIT_ACTIONS } from '@/lib/audit/log'

export async function GET(req) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') || 50), 200)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('backup_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ backups: data || [] })
}

export async function POST(req) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const backup = await createBackup({ triggeredBy: 'manual' })
    const pruned = await pruneExpiredBackups()
    await recordAuditLog({
      action: AUDIT_ACTIONS.BACKUP_CREATED,
      actor: access.user,
      resourceType: 'backup',
      resourceId: backup?.id,
      metadata: { triggered_by: 'manual', pruned },
      request: req,
    })
    return NextResponse.json({ success: true, backup, pruned })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Backup failed' }, { status: 500 })
  }
}
