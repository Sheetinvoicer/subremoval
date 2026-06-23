import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { restoreBackup } from '@/lib/backup/manager'

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
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Restore failed' }, { status: 500 })
  }
}
