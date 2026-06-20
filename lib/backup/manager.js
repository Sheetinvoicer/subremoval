import { createClient } from '@supabase/supabase-js'

const BACKUP_TABLES = ['clients', 'invoices', 'expenses', 'estimates', 'recurring_invoices']
const DEFAULT_BUCKET = 'sheetinvoicer-backups'

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

function buildSnapshotName() {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const fileStamp = now.toISOString().replace(/[:.]/g, '-')
  return {
    backupName: `supabase-backup-${fileStamp}`,
    storagePath: `${date}/supabase-backup-${fileStamp}.json`,
  }
}

export async function createBackup({ triggeredBy = 'manual' } = {}) {
  const supabase = createAdminClient()
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET
  const { backupName, storagePath } = buildSnapshotName()
  const snapshot = {}

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      throw new Error(`Unable to backup table ${table}: ${error.message}`)
    }
    snapshot[table] = data || []
  }

  const raw = JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    tables: snapshot,
  })

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, new Blob([raw], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Unable to upload backup snapshot: ${uploadError.message}`)
  }

  const sizeBytes = Buffer.byteLength(raw, 'utf8')
  const { data: backupEntry, error: historyError } = await supabase
    .from('backup_history')
    .insert({
      backup_name: backupName,
      storage_bucket: bucket,
      storage_path: storagePath,
      snapshot_tables: BACKUP_TABLES,
      status: 'completed',
      triggered_by: triggeredBy,
      size_bytes: sizeBytes,
    })
    .select('*')
    .single()

  if (historyError) {
    throw new Error(`Unable to persist backup history: ${historyError.message}`)
  }

  return backupEntry
}

export async function pruneExpiredBackups() {
  const supabase = createAdminClient()
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: oldBackups, error } = await supabase
    .from('backup_history')
    .select('id, storage_bucket, storage_path')
    .lt('created_at', cutoff)

  if (error) {
    throw new Error(`Unable to fetch old backups: ${error.message}`)
  }

  for (const item of oldBackups || []) {
    await supabase.storage.from(item.storage_bucket).remove([item.storage_path])
    await supabase.from('backup_history').delete().eq('id', item.id)
  }

  return (oldBackups || []).length
}

export async function restoreBackup(backupId) {
  const supabase = createAdminClient()
  const { data: backupRow, error: backupError } = await supabase
    .from('backup_history')
    .select('id, storage_bucket, storage_path')
    .eq('id', backupId)
    .single()

  if (backupError || !backupRow) {
    throw new Error('Backup record not found')
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(backupRow.storage_bucket)
    .download(backupRow.storage_path)

  if (downloadError || !fileData) {
    throw new Error('Backup snapshot is not accessible')
  }

  const content = await fileData.text()
  const parsed = JSON.parse(content)
  const tables = parsed?.tables || {}

  for (const table of BACKUP_TABLES) {
    const records = tables[table] || []
    await supabase.from(table).delete().neq('id', '__never__')
    if (records.length) {
      const { error: insertError } = await supabase.from(table).insert(records)
      if (insertError) {
        throw new Error(`Failed restoring table ${table}: ${insertError.message}`)
      }
    }
  }

  await supabase
    .from('backup_history')
    .update({ status: 'restored', restored_at: new Date().toISOString() })
    .eq('id', backupRow.id)

  return { restoredBackupId: backupRow.id }
}
