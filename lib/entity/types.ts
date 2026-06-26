/**
 * Shared types for the SheetInvoicer "Entity" — a human-in-the-loop AI
 * operations layer.
 *
 * Design principle: every real-world action (publishing content, changing
 * pricing, applying a code fix, charging a customer) is represented as an
 * {@link EntityAction} that a human must approve before it is ever executed.
 * Nothing in this system acts autonomously on production, customers, or money.
 */

/**
 * How much human oversight an action needs.
 * - `safe`   — no external side effect (e.g. compute an insight). May auto-run.
 * - `medium` — output is meant to leave the system (e.g. a marketing draft to
 *              publish). A human must review/approve before it is used.
 * - `high`   — critical/irreversible (publish, change pricing, apply a code
 *              fix, charge a customer). Always requires explicit approval.
 */
export type PermissionLevel = 'safe' | 'medium' | 'high'

/** The cooperating sub-systems of the Entity. */
export type EntityModule =
  | 'commander'
  | 'orchestrator'
  | 'self_healing'
  | 'marketing'
  | 'revenue'

/** Lifecycle of a single proposed action. */
export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'rolled_back'

/** Who performed an action — always a real, authenticated admin. */
export interface EntityActor {
  id: string | null
  email: string | null
}

/**
 * A single unit of work the Entity proposes. Persisted, auditable and (when it
 * has any external effect) gated behind explicit human approval.
 */
export interface EntityAction {
  id: string
  module: EntityModule
  type: string
  title: string
  summary: string
  permission: PermissionLevel
  status: ActionStatus
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  createdBy: EntityActor
  decidedBy: EntityActor | null
  /** Snapshot captured at execution time so the action can be reverted. */
  rollbackState: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

/** A planned task produced by the Commander and run by the Orchestrator. */
export interface EntityTask {
  id: string
  title: string
  description: string
  module: EntityModule
  permission: PermissionLevel
  dependsOn: string[]
}

/** The structured plan the Commander derives from a high-level goal. */
export interface EntityPlan {
  goal: string
  summary: string
  tasks: EntityTask[]
}

export type TaskOutcome = 'success' | 'failed' | 'skipped'

/** The result of running a single task through the Orchestrator. */
export interface TaskResult {
  taskId: string
  status: TaskOutcome
  output: unknown
  error: string | null
  durationMs: number
}

/** Provider-neutral request passed to an {@link AICaller}. */
export interface AICallRequest {
  system: string
  prompt: string
  maxTokens?: number
  temperature?: number
}

/**
 * Minimal AI abstraction. The production implementation calls Claude (see
 * `./ai`); tests inject a deterministic fake. Keeping this an interface is what
 * lets the logic modules stay free of any SDK import.
 */
export type AICaller = (request: AICallRequest) => Promise<string>

/** A persisted Commander command + its derived plan. */
export interface CommandRecord {
  id: string
  goal: string
  summary: string
  plan: EntityPlan
  status: 'planned' | 'executing' | 'completed' | 'failed'
  createdBy: EntityActor
  createdAt: string
}

/** Snapshot returned by the status endpoint / dashboard. */
export interface EntityStatus {
  emergencyStopped: boolean
  pendingApprovals: number
  totalActions: number
  recentActions: EntityAction[]
  recentCommands: CommandRecord[]
  modules: EntityModule[]
  generatedAt: string
}

/** Where an auto-detected issue originated. */
export type AlertSource = 'sentry' | 'vercel' | 'performance'

/** How urgent a detected issue is. */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

/** Lifecycle of an auto-detected alert. */
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed'

/**
 * A single issue surfaced by the detector (see `./detector`). De-duplicated by
 * {@link EntityAlert.fingerprint} and optionally linked to a proposed fix
 * action so an admin can review/apply it from the dashboard.
 */
export interface EntityAlert {
  id: string
  source: AlertSource
  severity: AlertSeverity
  title: string
  /** Stable de-duplication key for a recurring issue. */
  fingerprint: string
  status: AlertStatus
  details: Record<string, unknown>
  /** The proposed fix (`EntityAction.id`), when one was filed. */
  linkedActionId: string | null
  createdAt: string
  updatedAt: string
}

/** A single file written by an applied fix. */
export interface FixPatchFile {
  path: string
  contents: string
}

/**
 * A structured, machine-applicable patch carried in a `healing.fix` action's
 * payload. When present and valid, the dashboard exposes an **Apply** action
 * that opens a pull request from these files (see `./apply`). An absent or
 * invalid patch leaves the action review-only.
 */
export interface FixPatch {
  commitMessage: string
  branchName?: string
  files: FixPatchFile[]
}
