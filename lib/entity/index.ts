import { createClaudeAICaller } from './ai'
import { createSupabaseEntityStore } from './supabase-store'
import { Commander } from './commander'
import { Orchestrator } from './orchestrator'
import { Marketing } from './marketing'
import { Revenue } from './revenue'
import { SelfHealing } from './self-healing'
import { SafetyController } from './safety'
import { createMonitorClient } from './monitor'
import { runDetection } from './detector'
import type { EntityStore } from './store'
import type { MonitorClient } from './monitor'
import type { DetectionSummary } from './detector'
import type { AICaller, EntityActor, EntityModule, EntityStatus } from './types'

export interface EntityDeps {
  /** The authenticated admin acting on behalf of the entity. */
  actor: EntityActor
  /** Override the persistence layer (tests inject an in-memory store). */
  store?: EntityStore
  /** Override the AI caller (tests inject a deterministic fake). */
  ai?: AICaller
  /** Override the monitoring client (tests inject a fake). */
  monitor?: MonitorClient
}

/** The fully-wired Entity: a safety controller plus its cooperating modules. */
export interface Entity {
  store: EntityStore
  safety: SafetyController
  commander: Commander
  orchestrator: Orchestrator
  marketing: Marketing
  revenue: Revenue
  selfHealing: SelfHealing
  monitor: MonitorClient
}

export const ENTITY_MODULES: EntityModule[] = [
  'commander',
  'orchestrator',
  'self_healing',
  'marketing',
  'revenue',
]

/**
 * Assembles the Entity for a given admin actor. Defaults to the Supabase store
 * and the Claude caller; both are injectable so the whole graph is testable.
 */
export function createEntity({ actor, store, ai, monitor }: EntityDeps): Entity {
  const resolvedStore = store ?? createSupabaseEntityStore()
  const resolvedAi = ai ?? createClaudeAICaller()
  const safety = new SafetyController(resolvedStore, actor)
  return {
    store: resolvedStore,
    safety,
    commander: new Commander(resolvedAi),
    orchestrator: new Orchestrator(),
    marketing: new Marketing(resolvedAi, safety),
    revenue: new Revenue(resolvedAi, safety),
    selfHealing: new SelfHealing(resolvedAi, safety),
    monitor: monitor ?? createMonitorClient(),
  }
}

/** Runs a detection pass for an entity using its configured monitor. */
export function detectIssues(entity: Entity): Promise<DetectionSummary> {
  return runDetection(entity, entity.monitor)
}

/** Builds the dashboard/status snapshot for an entity. */
export async function getEntityStatus(entity: Entity): Promise<EntityStatus> {
  const [emergencyStopped, recentActions, recentCommands, pendingApprovals, totalActions] =
    await Promise.all([
      entity.safety.isEmergencyStopped(),
      entity.store.listActions({ limit: 20 }),
      entity.store.listCommands(10),
      entity.store.countActions({ status: 'pending' }),
      entity.store.countActions(),
    ])

  return {
    emergencyStopped,
    pendingApprovals,
    totalActions,
    recentActions,
    recentCommands,
    modules: ENTITY_MODULES,
    generatedAt: new Date().toISOString(),
  }
}

export * from './types'
export {
  SafetyController,
  EntityStoppedError,
  EntityActionError,
  classifyPermission,
  requiresApproval,
  PERMISSION_LEVELS,
} from './safety'
export { createInMemoryEntityStore } from './store'
export type { EntityStore } from './store'
export { Commander } from './commander'
export { Orchestrator } from './orchestrator'
export { Marketing } from './marketing'
export { Revenue } from './revenue'
export { SelfHealing } from './self-healing'
export { createMonitorClient, readMonitorEnv } from './monitor'
export type { MonitorClient, DetectedSignal, MonitorEnv } from './monitor'
export { runDetection } from './detector'
export type { DetectionSummary, DetectionTarget } from './detector'
export {
  createGitHubClient,
  createGitPrExecutor,
  readActionPatch,
  isApplicableFix,
  isGitConfigured,
  readGitHubEnv,
} from './apply'
export type { GitClient, GitHubEnv, GitRollbackState } from './apply'
export { getDeploymentStatus } from './deploy'
export type { DeploymentStatus, CiState } from './deploy'
export {
  createNotificationCenter,
  phasePercent,
  isActivePhase,
  ENTITY_STEPS,
  MAX_LOG_ENTRIES,
} from './notifications'
export type {
  EntityNotificationCenter,
  NotificationCenterOptions,
  EntityNotification,
  EntityProgressState,
  EntityLogEntry,
  EntityLogLevel,
  EntityPhase,
  EntityStep,
} from './notifications'
