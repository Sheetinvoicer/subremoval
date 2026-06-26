/**
 * Real-time progress & notification system for the Entity dashboard.
 *
 * The Entity's server operations (plan a goal, draft marketing, diagnose an
 * error, apply a fix) are single request/response calls — they do not stream.
 * To give operators real-time feedback we model the *phases* of an operation
 * on the client and broadcast phase changes plus a running activity log through
 * a tiny observable store. A React hook (see `components/EntityProgress.tsx`)
 * subscribes to it with `useSyncExternalStore` and forwards one-off
 * notifications to toasts.
 *
 * This module is deliberately framework-free (no React/Next imports) so it
 * stays unit-testable, mirroring the rest of `lib/entity/*`.
 */

/** The phases an Entity operation moves through, in order. */
export type EntityPhase = 'idle' | 'analyzing' | 'planning' | 'executing' | 'complete' | 'error'

/** Severity of a log line / notification. */
export type EntityLogLevel = 'info' | 'success' | 'warn' | 'error'

/** The ordered, user-visible steps shown in the progress tracker. */
export const ENTITY_STEPS = ['analyzing', 'planning', 'executing', 'complete'] as const

/** A single named step in {@link ENTITY_STEPS}. */
export type EntityStep = (typeof ENTITY_STEPS)[number]

/** A single line in the live activity log. */
export interface EntityLogEntry {
  id: string
  /** ISO-8601 timestamp. */
  at: string
  phase: EntityPhase
  level: EntityLogLevel
  message: string
}

/** A one-off notification, surfaced as a toast by the UI layer. */
export interface EntityNotification {
  id: string
  level: EntityLogLevel
  message: string
  at: string
}

/** Immutable snapshot consumed by the UI. */
export interface EntityProgressState {
  /** Current phase of the active (or last) operation. */
  phase: EntityPhase
  /** 0–100 progress derived from {@link phase}. */
  percent: number
  /** Human label for the running operation, or `null` when idle. */
  label: string | null
  /**
   * Index into {@link ENTITY_STEPS} of the furthest step reached. `-1` when
   * idle, `ENTITY_STEPS.length` once complete. This lets the tracker mark
   * done/active/pending even for operations that skip a step (e.g. a marketing
   * draft has no "planning" phase).
   */
  stepIndex: number
  /** Running activity log, oldest first, capped at {@link MAX_LOG_ENTRIES}. */
  log: EntityLogEntry[]
}

/** Maximum number of log lines retained in memory. */
export const MAX_LOG_ENTRIES = 50

const PHASE_PERCENT: Record<EntityPhase, number> = {
  idle: 0,
  analyzing: 25,
  planning: 55,
  executing: 80,
  complete: 100,
  error: 100,
}

const STEP_INDEX: Record<EntityStep, number> = {
  analyzing: 0,
  planning: 1,
  executing: 2,
  complete: 3,
}

/** Progress percentage (0–100) for a phase. */
export function phasePercent(phase: EntityPhase): number {
  return PHASE_PERCENT[phase]
}

/** Whether a phase represents an operation still in flight. */
export function isActivePhase(phase: EntityPhase): boolean {
  return phase === 'analyzing' || phase === 'planning' || phase === 'executing'
}

/**
 * The furthest step index a phase represents. `error` stays on the previously
 * reached step so the tracker can show *where* an operation failed.
 */
function stepIndexForPhase(phase: EntityPhase, previous: number): number {
  switch (phase) {
    case 'idle':
      return -1
    case 'complete':
      return ENTITY_STEPS.length
    case 'error':
      return previous
    default:
      return STEP_INDEX[phase]
  }
}

/** The observable store backing the dashboard's progress UI. */
export interface EntityNotificationCenter {
  /** Current immutable snapshot. Stable reference until something changes. */
  getState(): EntityProgressState
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Subscribe to one-off notifications (for toasts). Returns unsubscribe. */
  subscribeNotifications(listener: (notification: EntityNotification) => void): () => void
  /** Begin a new operation: enter `analyzing`, set the label, optionally log. */
  start(label: string, message?: string): void
  /** Transition to a phase, optionally appending a log line. */
  setPhase(phase: EntityPhase, message?: string, level?: EntityLogLevel): void
  /** Append a log line without changing the phase. */
  log(message: string, level?: EntityLogLevel): void
  /** Finish successfully: phase → `complete`, log + notify. */
  complete(message: string): void
  /** Finish with an error: phase → `error`, log + notify. */
  fail(message: string): void
  /** Return to idle, keeping the log. */
  reset(): void
  /** Clear the activity log and return to idle. */
  clear(): void
}

/** Construction-time overrides; tests inject deterministic id/clock factories. */
export interface NotificationCenterOptions {
  idFactory?: () => string
  now?: () => string
}

const EMPTY_STATE: EntityProgressState = {
  phase: 'idle',
  percent: 0,
  label: null,
  stepIndex: -1,
  log: [],
}

/**
 * Creates an {@link EntityNotificationCenter}. State snapshots are immutable and
 * only get a new reference when something actually changes, which is what makes
 * the store safe to drive React's `useSyncExternalStore`.
 */
export function createNotificationCenter(
  options: NotificationCenterOptions = {},
): EntityNotificationCenter {
  let counter = 0
  const idFactory = options.idFactory ?? (() => `evt-${++counter}`)
  const now = options.now ?? (() => new Date().toISOString())

  let state: EntityProgressState = EMPTY_STATE
  const listeners = new Set<() => void>()
  const notificationListeners = new Set<(notification: EntityNotification) => void>()

  function emit(): void {
    for (const listener of listeners) listener()
  }

  function appendLog(
    next: EntityProgressState,
    phase: EntityPhase,
    level: EntityLogLevel,
    message: string | undefined,
  ): EntityProgressState {
    if (!message) return next
    const entry: EntityLogEntry = { id: idFactory(), at: now(), phase, level, message }
    const log = [...next.log, entry]
    return {
      ...next,
      log: log.length > MAX_LOG_ENTRIES ? log.slice(log.length - MAX_LOG_ENTRIES) : log,
    }
  }

  function notify(level: EntityLogLevel, message: string): void {
    const notification: EntityNotification = { id: idFactory(), at: now(), level, message }
    for (const listener of notificationListeners) listener(notification)
  }

  function transition(phase: EntityPhase, message: string | undefined, level: EntityLogLevel): void {
    let next: EntityProgressState = {
      ...state,
      phase,
      percent: PHASE_PERCENT[phase],
      stepIndex: stepIndexForPhase(phase, state.stepIndex),
    }
    next = appendLog(next, phase, level, message)
    state = next
    emit()
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    subscribeNotifications(listener) {
      notificationListeners.add(listener)
      return () => {
        notificationListeners.delete(listener)
      }
    },
    start(label, message) {
      state = { ...state, label }
      transition('analyzing', message, 'info')
    },
    setPhase(phase, message, level = 'info') {
      transition(phase, message, level)
    },
    log(message, level = 'info') {
      state = appendLog(state, state.phase, level, message)
      emit()
    },
    complete(message) {
      transition('complete', message, 'success')
      notify('success', message)
    },
    fail(message) {
      transition('error', message, 'error')
      notify('error', message)
    },
    reset() {
      state = { ...state, phase: 'idle', percent: 0, label: null, stepIndex: -1 }
      emit()
    },
    clear() {
      state = EMPTY_STATE
      emit()
    },
  }
}
