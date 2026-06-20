import { NextResponse } from 'next/server'
import { createBackup, pruneExpiredBackups } from '@/lib/backup/manager'

export async function GET(req) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const backup = await createBackup({ triggeredBy: 'cron' })
    const pruned = await pruneExpiredBackups()

    return NextResponse.json({
      success: true,
      backupId: backup.id,
      pruned,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Backup failed' },
      { status: 500 }
    )
  }
}
