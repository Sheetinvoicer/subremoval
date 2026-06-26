import type { CommandRecord, EntityAction, EntityActor, EntityAlert } from './types'

export interface ListActionsFilter {
  status?: EntityAction['status']
  module?: EntityAction['module']
  limit?: number
}

export interface ListAlertsFilter {
  status?: EntityAlert['status']
  source?: EntityAlert['source']
  limit?: number
}

/** A single immutable audit-trail entry. */
export interface AuditEntry {
  action: string
  actor?: EntityActor | null
  resourceType?: string | null
  resourceId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Persistence boundary for the Entity.
 *
 * Production uses a Supabase-backed implementation (`./supabase-store`); tests
 * use {@link createInMemoryEntityStore}. Keeping persistence behind this
 * interface is what makes the safety controller and every module unit-testable
 * without a database or any SDK import.
 */
export interface EntityStore {
  insertAction(action: EntityAction): Promise<EntityAction>
  updateAction(id: string, patch: Partial<EntityAction>): Promise<EntityAction>
  getAction(id: string): Promise<EntityAction | null>
  listActions(filter?: ListActionsFilter): Promise<EntityAction[]>
  countActions(filter?: ListActionsFilter): Promise<number>
  insertCommand(command: CommandRecord): Promise<CommandRecord>
  listCommands(limit?: number): Promise<CommandRecord[]>
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  recordAudit(entry: AuditEntry): Promise<void>
  insertAlert(alert: EntityAlert): Promise<EntityAlert>
  updateAlert(id: string, patch: Partial<EntityAlert>): Promise<EntityAlert>
  listAlerts(filter?: ListAlertsFilter): Promise<EntityAlert[]>
  /** Most recent alert with this fingerprint (any status), or null. */
  findAlertByFingerprint(fingerprint: string): Promise<EntityAlert | null>
}

/** In-memory store used by tests. Exposes internals for assertions. */
export interface InMemoryEntityStore extends EntityStore {
  readonly actions: Map<string, EntityAction>
  readonly commands: Map<string, CommandRecord>
  readonly settings: Map<string, string>
  readonly alerts: Map<string, EntityAlert>
  readonly audit: AuditEntry[]
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Creates a fully in-memory {@link EntityStore}. Pure (no SDK imports) so it can
 * be imported safely from the jsdom test environment.
 */
export function createInMemoryEntityStore(): InMemoryEntityStore {
  const actions = new Map<string, EntityAction>()
  const commands = new Map<string, CommandRecord>()
  const settings = new Map<string, string>()
  const alerts = new Map<string, EntityAlert>()
  const audit: AuditEntry[] = []

  const byCreatedAtDesc = (a: { createdAt: string }, b: { createdAt: string }) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0

  return {
    actions,
    commands,
    settings,
    alerts,
    audit,

    async insertAction(action) {
      actions.set(action.id, clone(action))
      return clone(action)
    },

    async updateAction(id, patch) {
      const existing = actions.get(id)
      if (!existing) throw new Error(`Action ${id} not found`)
      const updated = { ...existing, ...clone(patch), id: existing.id }
      actions.set(id, updated)
      return clone(updated)
    },

    async getAction(id) {
      const found = actions.get(id)
      return found ? clone(found) : null
    },

    async listActions(filter = {}) {
      let rows = Array.from(actions.values())
      if (filter.status) rows = rows.filter((r) => r.status === filter.status)
      if (filter.module) rows = rows.filter((r) => r.module === filter.module)
      rows.sort(byCreatedAtDesc)
      if (filter.limit != null) rows = rows.slice(0, filter.limit)
      return rows.map(clone)
    },

    async countActions(filter = {}) {
      let rows = Array.from(actions.values())
      if (filter.status) rows = rows.filter((r) => r.status === filter.status)
      if (filter.module) rows = rows.filter((r) => r.module === filter.module)
      return rows.length
    },

    async insertCommand(command) {
      commands.set(command.id, clone(command))
      return clone(command)
    },

    async listCommands(limit) {
      const rows = Array.from(commands.values()).sort(byCreatedAtDesc)
      return (limit != null ? rows.slice(0, limit) : rows).map(clone)
    },

    async getSetting(key) {
      return settings.has(key) ? settings.get(key)! : null
    },

    async setSetting(key, value) {
      settings.set(key, value)
    },

    async recordAudit(entry) {
      audit.push(clone(entry))
    },

    async insertAlert(alert) {
      alerts.set(alert.id, clone(alert))
      return clone(alert)
    },

    async updateAlert(id, patch) {
      const existing = alerts.get(id)
      if (!existing) throw new Error(`Alert ${id} not found`)
      const updated = { ...existing, ...clone(patch), id: existing.id }
      alerts.set(id, updated)
      return clone(updated)
    },

    async listAlerts(filter = {}) {
      let rows = Array.from(alerts.values())
      if (filter.status) rows = rows.filter((r) => r.status === filter.status)
      if (filter.source) rows = rows.filter((r) => r.source === filter.source)
      rows.sort(byCreatedAtDesc)
      if (filter.limit != null) rows = rows.slice(0, filter.limit)
      return rows.map(clone)
    },

    async findAlertByFingerprint(fingerprint) {
      const rows = Array.from(alerts.values())
        .filter((r) => r.fingerprint === fingerprint)
        .sort(byCreatedAtDesc)
      return rows.length ? clone(rows[0]) : null
    },
  }
}
