import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recordAuditLog } from '@/lib/audit/log'
import type { AuditEntry, EntityStore, ListActionsFilter, ListAlertsFilter } from './store'
import type { CommandRecord, EntityAction, EntityAlert } from './types'

const ACTIONS_TABLE = 'entity_actions'
const COMMANDS_TABLE = 'entity_commands'
const SETTINGS_TABLE = 'entity_settings'
const ALERTS_TABLE = 'entity_alerts'

/**
 * Entity rows are written by trusted server code on behalf of an admin, so we
 * use the Supabase service-role key here exactly like lib/audit/log.js does.
 * Reads from the dashboard go through RLS (`public.is_admin()`), not this key.
 */
function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase admin environment variables')
  }
  return createClient(url, key)
}

type ActionRow = {
  id: string
  module: EntityAction['module']
  type: string
  title: string
  summary: string
  permission: EntityAction['permission']
  status: EntityAction['status']
  payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: string | null
  created_by: string | null
  created_by_email: string | null
  decided_by: string | null
  decided_by_email: string | null
  rollback_state: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function fromActionRow(row: ActionRow): EntityAction {
  return {
    id: row.id,
    module: row.module,
    type: row.type,
    title: row.title,
    summary: row.summary,
    permission: row.permission,
    status: row.status,
    payload: row.payload ?? {},
    result: row.result ?? null,
    error: row.error ?? null,
    createdBy: { id: row.created_by, email: row.created_by_email },
    decidedBy:
      row.decided_by || row.decided_by_email
        ? { id: row.decided_by, email: row.decided_by_email }
        : null,
    rollbackState: row.rollback_state ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toActionInsert(action: EntityAction): ActionRow {
  return {
    id: action.id,
    module: action.module,
    type: action.type,
    title: action.title,
    summary: action.summary,
    permission: action.permission,
    status: action.status,
    payload: action.payload,
    result: action.result,
    error: action.error,
    created_by: action.createdBy.id,
    created_by_email: action.createdBy.email,
    decided_by: action.decidedBy?.id ?? null,
    decided_by_email: action.decidedBy?.email ?? null,
    rollback_state: action.rollbackState,
    created_at: action.createdAt,
    updated_at: action.updatedAt,
  }
}

/** Translates a partial domain patch into the snake_case columns to update. */
function toActionUpdate(patch: Partial<EntityAction>): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  if (patch.status !== undefined) update.status = patch.status
  if (patch.result !== undefined) update.result = patch.result
  if (patch.error !== undefined) update.error = patch.error
  if (patch.payload !== undefined) update.payload = patch.payload
  if (patch.rollbackState !== undefined) update.rollback_state = patch.rollbackState
  if (patch.updatedAt !== undefined) update.updated_at = patch.updatedAt
  if (patch.decidedBy !== undefined) {
    update.decided_by = patch.decidedBy?.id ?? null
    update.decided_by_email = patch.decidedBy?.email ?? null
  }
  return update
}

type AlertRow = {
  id: string
  source: EntityAlert['source']
  severity: EntityAlert['severity']
  title: string
  fingerprint: string
  status: EntityAlert['status']
  details: Record<string, unknown> | null
  linked_action_id: string | null
  created_at: string
  updated_at: string
}

function fromAlertRow(row: AlertRow): EntityAlert {
  return {
    id: row.id,
    source: row.source,
    severity: row.severity,
    title: row.title,
    fingerprint: row.fingerprint,
    status: row.status,
    details: row.details ?? {},
    linkedActionId: row.linked_action_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toAlertInsert(alert: EntityAlert): AlertRow {
  return {
    id: alert.id,
    source: alert.source,
    severity: alert.severity,
    title: alert.title,
    fingerprint: alert.fingerprint,
    status: alert.status,
    details: alert.details,
    linked_action_id: alert.linkedActionId,
    created_at: alert.createdAt,
    updated_at: alert.updatedAt,
  }
}

/** Translates a partial domain patch into the snake_case columns to update. */
function toAlertUpdate(patch: Partial<EntityAlert>): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  if (patch.status !== undefined) update.status = patch.status
  if (patch.severity !== undefined) update.severity = patch.severity
  if (patch.title !== undefined) update.title = patch.title
  if (patch.details !== undefined) update.details = patch.details
  if (patch.linkedActionId !== undefined) update.linked_action_id = patch.linkedActionId
  if (patch.updatedAt !== undefined) update.updated_at = patch.updatedAt
  return update
}

/** Production {@link EntityStore} backed by Supabase + the shared audit log. */
export function createSupabaseEntityStore(): EntityStore {
  const supabase = createAdminClient()

  return {
    async insertAction(action) {
      const { data, error } = await supabase
        .from(ACTIONS_TABLE)
        .insert(toActionInsert(action))
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return fromActionRow(data as ActionRow)
    },

    async updateAction(id, patch) {
      const { data, error } = await supabase
        .from(ACTIONS_TABLE)
        .update(toActionUpdate(patch))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return fromActionRow(data as ActionRow)
    },

    async getAction(id) {
      const { data, error } = await supabase
        .from(ACTIONS_TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? fromActionRow(data as ActionRow) : null
    },

    async listActions(filter: ListActionsFilter = {}) {
      let query = supabase
        .from(ACTIONS_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.module) query = query.eq('module', filter.module)
      if (filter.limit != null) query = query.limit(filter.limit)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data as ActionRow[]).map(fromActionRow)
    },

    async countActions(filter: ListActionsFilter = {}) {
      let query = supabase.from(ACTIONS_TABLE).select('id', { count: 'exact', head: true })
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.module) query = query.eq('module', filter.module)
      const { count, error } = await query
      if (error) throw new Error(error.message)
      return count ?? 0
    },

    async insertCommand(command) {
      const { data, error } = await supabase
        .from(COMMANDS_TABLE)
        .insert({
          id: command.id,
          goal: command.goal,
          summary: command.summary,
          plan: command.plan,
          status: command.status,
          created_by: command.createdBy.id,
          created_by_email: command.createdBy.email,
          created_at: command.createdAt,
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      const row = data as Record<string, unknown>
      return {
        id: row.id as string,
        goal: row.goal as string,
        summary: row.summary as string,
        plan: row.plan as CommandRecord['plan'],
        status: row.status as CommandRecord['status'],
        createdBy: { id: (row.created_by as string) ?? null, email: (row.created_by_email as string) ?? null },
        createdAt: row.created_at as string,
      }
    },

    async listCommands(limit) {
      let query = supabase
        .from(COMMANDS_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
      if (limit != null) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        goal: row.goal as string,
        summary: row.summary as string,
        plan: row.plan as CommandRecord['plan'],
        status: row.status as CommandRecord['status'],
        createdBy: { id: (row.created_by as string) ?? null, email: (row.created_by_email as string) ?? null },
        createdAt: row.created_at as string,
      }))
    },

    async getSetting(key) {
      const { data, error } = await supabase
        .from(SETTINGS_TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? ((data as { value: string | null }).value ?? null) : null
    },

    async setSetting(key, value) {
      const { error } = await supabase
        .from(SETTINGS_TABLE)
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) throw new Error(error.message)
    },

    async recordAudit(entry: AuditEntry) {
      // Reuse the existing immutable audit trail (audit_logs) so entity activity
      // shows up alongside every other audited action in the admin UI.
      await recordAuditLog({
        action: entry.action,
        actor: entry.actor ?? null,
        resourceType: entry.resourceType ?? 'entity',
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ?? {},
      })
    },

    async insertAlert(alert) {
      const { data, error } = await supabase
        .from(ALERTS_TABLE)
        .insert(toAlertInsert(alert))
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return fromAlertRow(data as AlertRow)
    },

    async updateAlert(id, patch) {
      const { data, error } = await supabase
        .from(ALERTS_TABLE)
        .update(toAlertUpdate(patch))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return fromAlertRow(data as AlertRow)
    },

    async listAlerts(filter: ListAlertsFilter = {}) {
      let query = supabase
        .from(ALERTS_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.source) query = query.eq('source', filter.source)
      if (filter.limit != null) query = query.limit(filter.limit)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data as AlertRow[]).map(fromAlertRow)
    },

    async findAlertByFingerprint(fingerprint) {
      const { data, error } = await supabase
        .from(ALERTS_TABLE)
        .select('*')
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? fromAlertRow(data as AlertRow) : null
    },
  }
}
