import type { EntityStore } from './store'
import type { SelfHealing } from './self-healing'
import type { DetectedSignal, MonitorClient } from './monitor'
import type { AlertSeverity, EntityAlert } from './types'

/**
 * The slice of a fully-wired {@link import('./index').Entity} the detector
 * needs. Declaring it structurally (rather than importing `Entity`) keeps this
 * module free of the route/SDK graph and trivially testable with fakes.
 */
export interface DetectionTarget {
  store: EntityStore
  selfHealing: SelfHealing
}

/** Outcome of a single detection run, surfaced to the cron/API caller. */
export interface DetectionSummary {
  scanned: number
  created: number
  duplicates: number
  proposalsFiled: number
  alerts: EntityAlert[]
}

/** Severities that warrant an automatic AI fix proposal. */
const HIGH_CONFIDENCE: ReadonlySet<AlertSeverity> = new Set(['high', 'critical'])

/** An alert with one of these statuses already covers an issue; don't re-raise. */
function isActive(status: EntityAlert['status']): boolean {
  return status === 'open' || status === 'acknowledged'
}

function newAlertId(): string {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID()
  return `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function toErrorReport(signal: DetectedSignal) {
  const details = signal.details ?? {}
  const message = typeof details.message === 'string' ? details.message : undefined
  const stack = typeof details.stack === 'string' ? details.stack : undefined
  const occurrences = typeof details.count === 'number' ? details.count : undefined
  return {
    title: signal.title,
    message,
    stack,
    occurrences,
    source: signal.source,
  }
}

/**
 * Runs one detection pass: collects signals from the monitor, de-duplicates
 * them against still-active alerts by fingerprint, persists the new ones, and —
 * for high-confidence signals — files an AI `healing.fix` proposal and links it
 * back to the alert.
 *
 * Alert persistence is observational and runs even under an emergency stop;
 * proposal filing goes through the SafetyController, so if the entity is stopped
 * (or the AI call fails) the alert is still recorded without a linked proposal.
 */
export async function runDetection(
  target: DetectionTarget,
  monitor: MonitorClient,
): Promise<DetectionSummary> {
  const signals = await monitor.collectSignals()
  const summary: DetectionSummary = {
    scanned: signals.length,
    created: 0,
    duplicates: 0,
    proposalsFiled: 0,
    alerts: [],
  }

  // Track fingerprints created within this run so a provider that returns the
  // same issue twice doesn't produce duplicate alerts.
  const seen = new Set<string>()

  for (const signal of signals) {
    if (seen.has(signal.fingerprint)) {
      summary.duplicates += 1
      continue
    }
    const existing = await target.store.findAlertByFingerprint(signal.fingerprint)
    if (existing && isActive(existing.status)) {
      summary.duplicates += 1
      continue
    }
    seen.add(signal.fingerprint)

    const now = new Date().toISOString()
    let alert = await target.store.insertAlert({
      id: newAlertId(),
      source: signal.source,
      severity: signal.severity,
      title: signal.title,
      fingerprint: signal.fingerprint,
      status: 'open',
      details: signal.details ?? {},
      linkedActionId: null,
      createdAt: now,
      updatedAt: now,
    })
    summary.created += 1

    if (HIGH_CONFIDENCE.has(signal.severity)) {
      try {
        const action = await target.selfHealing.analyze(toErrorReport(signal))
        alert = await target.store.updateAlert(alert.id, {
          linkedActionId: action.id,
          updatedAt: new Date().toISOString(),
        })
        summary.proposalsFiled += 1
      } catch (err) {
        // A stopped entity or a failed AI call must not abort the whole scan;
        // the alert stands on its own and can be addressed manually.
        console.error(`Entity detector: failed to file fix proposal for ${signal.fingerprint}`, err)
      }
    }

    summary.alerts.push(alert)
  }

  return summary
}
