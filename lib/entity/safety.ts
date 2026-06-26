import type {
  EntityAction,
  EntityActor,
  EntityModule,
  PermissionLevel,
} from './types'
import type { EntityStore } from './store'

/** Canonical permission-level constants. */
export const PERMISSION_LEVELS = {
  SAFE: 'safe',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

/**
 * Maps a known action type to the oversight it requires. Unknown types default
 * to `high` so anything the system doesn't recognise fails safe (requires a
 * human). This table is the single source of truth for "what can auto-run".
 */
const ACTION_PERMISSIONS: Record<string, PermissionLevel> = {
  'command.plan': 'safe',
  'orchestrator.run': 'medium',
  'revenue.insight': 'safe',
  'revenue.recommendation': 'medium',
  'revenue.pricing_change': 'high',
  'marketing.draft': 'medium',
  'marketing.publish': 'high',
  'healing.diagnosis': 'safe',
  'healing.fix': 'high',
}

export function classifyPermission(type: string): PermissionLevel {
  return ACTION_PERMISSIONS[type] ?? 'high'
}

/** Only `safe` actions can ever run without an explicit human approval. */
export function requiresApproval(level: PermissionLevel): boolean {
  return level !== 'safe'
}

/** Settings key holding the emergency-stop flag. */
export const EMERGENCY_STOP_KEY = 'emergency_stop'

export class EntityStoppedError extends Error {
  readonly code = 'ENTITY_STOPPED'
  constructor(message = 'The entity is under an emergency stop; no actions can run.') {
    super(message)
    this.name = 'EntityStoppedError'
  }
}

export class EntityActionError extends Error {
  readonly code = 'ENTITY_ACTION_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'EntityActionError'
  }
}

function generateId(): string {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID()
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export interface ProposeInput {
  module: EntityModule
  type: string
  title: string
  summary: string
  payload?: Record<string, unknown>
  /** Override the classified permission (rarely needed). */
  permission?: PermissionLevel
}

/**
 * Performs the real-world effect of an action and returns what was done plus a
 * snapshot to revert it. For the modules shipped here there is no live
 * integration, so executors only record the human's decision — wiring a real
 * effect (e.g. an actual social post) means supplying a different executor.
 */
export type Executor = (action: EntityAction) => Promise<{
  result?: Record<string, unknown>
  rollbackState?: Record<string, unknown>
}>

/**
 * The heart of the Entity's safety model. Every proposal, approval, rejection,
 * execution and rollback flows through here, is persisted, and is written to
 * the immutable audit trail. The emergency stop blocks all execution.
 */
export class SafetyController {
  constructor(
    private readonly store: EntityStore,
    private readonly actor: EntityActor,
  ) {}

  async isEmergencyStopped(): Promise<boolean> {
    return (await this.store.getSetting(EMERGENCY_STOP_KEY)) === 'true'
  }

  /** Engages/releases the global emergency stop and audits the change. */
  async setEmergencyStop(engaged: boolean): Promise<void> {
    await this.store.setSetting(EMERGENCY_STOP_KEY, engaged ? 'true' : 'false')
    await this.store.recordAudit({
      action: engaged
        ? 'entity.emergency_stop_engaged'
        : 'entity.emergency_stop_released',
      actor: this.actor,
      resourceType: 'entity',
    })
  }

  private async assertRunnable(): Promise<void> {
    if (await this.isEmergencyStopped()) throw new EntityStoppedError()
  }

  /**
   * Records a proposed action. `safe` actions (no external effect) execute
   * immediately when an executor is supplied; everything else is left `pending`
   * for a human to approve. Always blocked while the emergency stop is engaged.
   */
  async propose(input: ProposeInput, executor?: Executor): Promise<EntityAction> {
    await this.assertRunnable()
    const permission = input.permission ?? classifyPermission(input.type)
    const now = new Date().toISOString()
    const action: EntityAction = {
      id: generateId(),
      module: input.module,
      type: input.type,
      title: input.title,
      summary: input.summary,
      permission,
      status: 'pending',
      payload: input.payload ?? {},
      result: null,
      error: null,
      createdBy: this.actor,
      decidedBy: null,
      rollbackState: null,
      createdAt: now,
      updatedAt: now,
    }
    const stored = await this.store.insertAction(action)
    await this.store.recordAudit({
      action: 'entity.action_proposed',
      actor: this.actor,
      resourceType: 'entity_action',
      resourceId: stored.id,
      metadata: { type: stored.type, permission },
    })

    if (permission === 'safe' && executor) {
      return this.execute(stored, executor)
    }
    return stored
  }

  /** Approves a pending action and (optionally) executes it in the same step. */
  async approve(actionId: string, executor?: Executor): Promise<EntityAction> {
    await this.assertRunnable()
    const action = await this.requireAction(actionId)
    if (action.status !== 'pending') {
      throw new EntityActionError(
        `Action ${actionId} is not pending (status: ${action.status}).`,
      )
    }
    const approved = await this.store.updateAction(actionId, {
      status: 'approved',
      decidedBy: this.actor,
      updatedAt: new Date().toISOString(),
    })
    await this.store.recordAudit({
      action: 'entity.action_approved',
      actor: this.actor,
      resourceType: 'entity_action',
      resourceId: actionId,
      metadata: { type: action.type, permission: action.permission },
    })
    return executor ? this.execute(approved, executor) : approved
  }

  /** Rejects a pending action — it can never be executed afterwards. */
  async reject(actionId: string): Promise<EntityAction> {
    const action = await this.requireAction(actionId)
    if (action.status !== 'pending') {
      throw new EntityActionError(
        `Action ${actionId} is not pending (status: ${action.status}).`,
      )
    }
    const rejected = await this.store.updateAction(actionId, {
      status: 'rejected',
      decidedBy: this.actor,
      updatedAt: new Date().toISOString(),
    })
    await this.store.recordAudit({
      action: 'entity.action_rejected',
      actor: this.actor,
      resourceType: 'entity_action',
      resourceId: actionId,
      metadata: { type: action.type },
    })
    return rejected
  }

  /**
   * Runs the executor for an already-approved action (or a `safe` pending one)
   * and records the outcome. Failures are captured, never thrown to the caller
   * as an unhandled error, so a single bad action can't crash a batch.
   */
  async execute(action: EntityAction, executor: Executor): Promise<EntityAction> {
    await this.assertRunnable()
    const runnable =
      action.status === 'approved' ||
      (action.status === 'pending' && action.permission === 'safe')
    if (!runnable) {
      throw new EntityActionError(
        `Action ${action.id} must be approved before execution.`,
      )
    }
    try {
      const { result, rollbackState } = await executor(action)
      const executed = await this.store.updateAction(action.id, {
        status: 'executed',
        result: result ?? {},
        rollbackState: rollbackState ?? null,
        updatedAt: new Date().toISOString(),
      })
      await this.store.recordAudit({
        action: 'entity.action_executed',
        actor: this.actor,
        resourceType: 'entity_action',
        resourceId: action.id,
        metadata: { type: action.type },
      })
      return executed
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed'
      const failed = await this.store.updateAction(action.id, {
        status: 'failed',
        error: message,
        updatedAt: new Date().toISOString(),
      })
      await this.store.recordAudit({
        action: 'entity.action_failed',
        actor: this.actor,
        resourceType: 'entity_action',
        resourceId: action.id,
        metadata: { type: action.type, error: message },
      })
      return failed
    }
  }

  /** Reverts a previously executed action and records the rollback. */
  async rollback(actionId: string): Promise<EntityAction> {
    const action = await this.requireAction(actionId)
    if (action.status !== 'executed') {
      throw new EntityActionError(
        `Only executed actions can be rolled back (status: ${action.status}).`,
      )
    }
    const rolledBack = await this.store.updateAction(actionId, {
      status: 'rolled_back',
      decidedBy: this.actor,
      updatedAt: new Date().toISOString(),
    })
    await this.store.recordAudit({
      action: 'entity.action_rolled_back',
      actor: this.actor,
      resourceType: 'entity_action',
      resourceId: actionId,
      metadata: { type: action.type, rollbackState: action.rollbackState },
    })
    return rolledBack
  }

  private async requireAction(actionId: string): Promise<EntityAction> {
    const action = await this.store.getAction(actionId)
    if (!action) throw new EntityActionError(`Action ${actionId} not found.`)
    return action
  }
}
