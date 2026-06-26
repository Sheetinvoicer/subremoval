import type { AlertSeverity, AlertSource } from './types'

/**
 * A single normalized issue surfaced by an external monitoring provider. The
 * detector (see `./detector`) turns these into de-duplicated `entity_alerts`
 * rows and, for high-confidence ones, AI fix proposals.
 */
export interface DetectedSignal {
  source: AlertSource
  /** Stable de-duplication key (e.g. `sentry:<issueId>`). */
  fingerprint: string
  title: string
  severity: AlertSeverity
  details: Record<string, unknown>
}

/**
 * Provider-neutral monitoring boundary. The production implementation polls
 * Sentry/Vercel/performance via `fetch` (see {@link createMonitorClient}); tests
 * inject a deterministic fake. Keeping this an interface is what lets the
 * detector stay free of any network access and fully unit-testable.
 */
export interface MonitorClient {
  collectSignals(): Promise<DetectedSignal[]>
}

/** Resolved provider configuration. Any missing field disables that source. */
export interface MonitorEnv {
  sentryAuthToken?: string
  sentryOrg?: string
  sentryProject?: string
  vercelApiToken?: string
  vercelProjectId?: string
  vercelTeamId?: string
  /**
   * Optional JSON endpoint returning slow-route metrics, shaped like
   * `{ metrics: [{ route, p95Ms, thresholdMs }] }`. When unset, performance
   * detection is skipped.
   */
  perfMetricsUrl?: string
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

/** Reads monitoring configuration from `process.env`. */
export function readMonitorEnv(): MonitorEnv {
  return {
    sentryAuthToken: process.env.SENTRY_AUTH_TOKEN,
    sentryOrg: process.env.SENTRY_ORG,
    sentryProject: process.env.SENTRY_PROJECT,
    vercelApiToken: process.env.VERCEL_API_TOKEN,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
    vercelTeamId: process.env.VERCEL_TEAM_ID,
    perfMetricsUrl: process.env.PERF_METRICS_URL,
  }
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : undefined
}

/** Maps a Sentry issue level + occurrence count to an alert severity. */
function sentrySeverity(level: unknown, count: number | undefined): AlertSeverity {
  const lvl = typeof level === 'string' ? level.toLowerCase() : ''
  let severity: AlertSeverity =
    lvl === 'fatal' ? 'critical' : lvl === 'error' ? 'high' : lvl === 'warning' ? 'medium' : 'low'
  // A frequently-firing issue is escalated regardless of its label.
  if ((count ?? 0) >= 100 && severity !== 'critical') severity = 'high'
  return severity
}

async function collectSentry(env: MonitorEnv, doFetch: typeof fetch): Promise<DetectedSignal[]> {
  const { sentryAuthToken, sentryOrg, sentryProject } = env
  if (!sentryAuthToken || !sentryOrg || !sentryProject) return []

  const url = `https://sentry.io/api/0/projects/${encodeURIComponent(sentryOrg)}/${encodeURIComponent(
    sentryProject,
  )}/issues/?query=${encodeURIComponent('is:unresolved')}&statsPeriod=24h&limit=25`

  const res = await doFetch(url, {
    headers: { Authorization: `Bearer ${sentryAuthToken}` },
  })
  if (!res.ok) throw new Error(`Sentry responded ${res.status}`)
  const issues = (await res.json()) as unknown
  if (!Array.isArray(issues)) return []

  return issues.map((raw) => {
    const issue = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const id = String(issue.id ?? issue.shortId ?? '')
    const count = num(issue.count)
    const metadata = (issue.metadata && typeof issue.metadata === 'object'
      ? issue.metadata
      : {}) as Record<string, unknown>
    return {
      source: 'sentry' as const,
      fingerprint: `sentry:${id}`,
      title: String(issue.title ?? metadata.type ?? 'Sentry issue'),
      severity: sentrySeverity(issue.level, count),
      details: {
        culprit: issue.culprit ?? null,
        count: count ?? null,
        permalink: issue.permalink ?? null,
        message: metadata.value ?? issue.title ?? null,
        shortId: issue.shortId ?? null,
      },
    }
  })
}

async function collectVercel(env: MonitorEnv, doFetch: typeof fetch): Promise<DetectedSignal[]> {
  const { vercelApiToken, vercelProjectId, vercelTeamId } = env
  if (!vercelApiToken || !vercelProjectId) return []

  const params = new URLSearchParams({
    projectId: vercelProjectId,
    state: 'ERROR',
    limit: '20',
  })
  if (vercelTeamId) params.set('teamId', vercelTeamId)

  const res = await doFetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
    headers: { Authorization: `Bearer ${vercelApiToken}` },
  })
  if (!res.ok) throw new Error(`Vercel responded ${res.status}`)
  const body = (await res.json()) as { deployments?: unknown }
  const deployments = Array.isArray(body?.deployments) ? body.deployments : []

  return deployments.map((raw) => {
    const dep = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const uid = String(dep.uid ?? dep.id ?? '')
    return {
      source: 'vercel' as const,
      fingerprint: `vercel:deploy:${uid}`,
      title: `Deployment failed: ${String(dep.name ?? 'unknown')}`,
      severity: 'high' as const,
      details: {
        uid,
        url: dep.url ?? null,
        state: dep.state ?? 'ERROR',
        createdAt: dep.createdAt ?? null,
      },
    }
  })
}

async function collectPerformance(env: MonitorEnv, doFetch: typeof fetch): Promise<DetectedSignal[]> {
  const { perfMetricsUrl } = env
  if (!perfMetricsUrl) return []

  const res = await doFetch(perfMetricsUrl)
  if (!res.ok) throw new Error(`Performance endpoint responded ${res.status}`)
  const body = (await res.json()) as { metrics?: unknown }
  const metrics = Array.isArray(body?.metrics) ? body.metrics : []

  const signals: DetectedSignal[] = []
  for (const raw of metrics) {
    const metric = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const route = typeof metric.route === 'string' ? metric.route : null
    const p95 = num(metric.p95Ms)
    const threshold = num(metric.thresholdMs) ?? 1000
    if (!route || p95 === undefined || p95 <= threshold) continue
    signals.push({
      source: 'performance',
      fingerprint: `performance:${route}`,
      title: `Slow route: ${route} (p95 ${Math.round(p95)}ms)`,
      severity: p95 > threshold * 3 ? 'high' : 'medium',
      details: { route, p95Ms: p95, thresholdMs: threshold },
    })
  }
  return signals
}

/**
 * Creates the production {@link MonitorClient}. Each source is independent:
 * a missing-credential source yields no signals, and a transient provider
 * failure is logged and skipped so one bad source never aborts a scan.
 */
export function createMonitorClient(env: MonitorEnv = readMonitorEnv()): MonitorClient {
  const doFetch = env.fetchImpl ?? globalThis.fetch
  return {
    async collectSignals() {
      const sources: Array<[AlertSource, Promise<DetectedSignal[]>]> = [
        ['sentry', collectSentry(env, doFetch)],
        ['vercel', collectVercel(env, doFetch)],
        ['performance', collectPerformance(env, doFetch)],
      ]
      const settled = await Promise.all(
        sources.map(async ([source, promise]) => {
          try {
            return await promise
          } catch (err) {
            console.error(`Entity monitor: ${source} source failed`, err)
            return []
          }
        }),
      )
      return settled.flat()
    },
  }
}
