'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import {
  Bot,
  ShieldAlert,
  ShieldCheck,
  Megaphone,
  Wrench,
  TrendingUp,
  Loader2,
  RefreshCw,
  Check,
  X,
  Undo2,
  Activity,
  Send,
  Info,
  GitPullRequest,
  ExternalLink,
  Bell,
  EyeOff,
  Radar,
} from 'lucide-react'
import RoleGuard from '@/components/RoleGuard'
import { EntityProgress, useEntityProgress } from '@/components/EntityProgress'
import type {
  ActionStatus,
  EntityAction,
  EntityAlert,
  EntityPlan,
  EntityStatus,
  PermissionLevel,
} from '@/lib/entity/types'

const PERMISSION_STYLES: Record<PermissionLevel, string> = {
  safe: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const STATUS_STYLES: Record<ActionStatus, string> = {
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  rejected: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  executed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  rolled_back: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const ALERT_SEVERITY_STYLES: Record<EntityAlert['severity'], string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const MARKETING_CHANNELS = ['blog', 'twitter', 'linkedin', 'instagram', 'email'] as const

function payloadPreview(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null
  for (const key of ['content', 'diagnosis', 'recommendations']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

/**
 * Whether an action carries an applicable patch (mirrors the server-side
 * `readActionPatch`). Gates the Apply button so a malformed/absent patch can
 * never be applied from the UI.
 */
function hasValidPatch(payload: Record<string, unknown> | undefined): boolean {
  const patch = payload?.patch as { commitMessage?: unknown; files?: unknown } | undefined
  if (!patch || typeof patch !== 'object') return false
  const files = Array.isArray(patch.files) ? patch.files : []
  return (
    typeof patch.commitMessage === 'string' && patch.commitMessage.trim().length > 0 && files.length > 0
  )
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((payload && (payload.error as string)) || `Request failed (${res.status})`)
  }
  return payload || {}
}

/** A small UX delay so a fast phase (e.g. "Planning") stays perceptible. */
const PLANNING_REVEAL_MS = 600

function tick(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function EntityContent() {
  const t = useTranslations('entity')

  const [status, setStatus] = useState<EntityStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [goal, setGoal] = useState('')
  const [plan, setPlan] = useState<EntityPlan | null>(null)
  const [commandLoading, setCommandLoading] = useState(false)

  const [channel, setChannel] = useState<(typeof MARKETING_CHANNELS)[number]>('linkedin')
  const [topic, setTopic] = useState('')
  const [marketLoading, setMarketLoading] = useState(false)

  const [healTitle, setHealTitle] = useState('')
  const [healMessage, setHealMessage] = useState('')
  const [healLoading, setHealLoading] = useState(false)

  const [revenueLoading, setRevenueLoading] = useState(false)

  const [alerts, setAlerts] = useState<EntityAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [alertBusyId, setAlertBusyId] = useState<string | null>(null)

  // Real-time progress + notification center driving the live progress panel.
  const { center, state: progress } = useEntityProgress()

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/entity/status', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || t('errors.generic'))
      setStatus(payload.status as EntityStatus)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/entity/alerts', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || t('errors.generic'))
      setAlerts((payload.alerts as EntityAlert[]) ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setAlertsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadStatus()
    loadAlerts()
  }, [loadStatus, loadAlerts])

  const toggleStop = useCallback(
    async (engaged: boolean) => {
      try {
        await postJson('/api/entity/emergency-stop', { engaged })
        toast.success(engaged ? t('toasts.stopEngaged') : t('toasts.stopReleased'))
        await loadStatus()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('errors.generic'))
      }
    },
    [loadStatus, t],
  )

  const runCommand = useCallback(async () => {
    if (!goal.trim()) return
    setCommandLoading(true)
    // Phase 1 (analyzing) stays visible while the request is in flight, then
    // phase 2 (planning) once the plan returns; see the i18n `progress.*` keys.
    center.start(t('progress.labels.command'), t('progress.logs.analyzingGoal'))
    try {
      const data = await postJson('/api/entity/command', { goal })
      const planData = (data.plan as EntityPlan | undefined) ?? null
      center.setPhase('planning', t('progress.logs.planning'))
      await tick(PLANNING_REVEAL_MS)
      setPlan(planData)
      center.complete(t('progress.logs.planReady', { count: planData?.tasks.length ?? 0 }))
    } catch (err) {
      center.fail(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setCommandLoading(false)
    }
  }, [goal, center, t])

  const generateDraft = useCallback(async () => {
    if (!topic.trim()) return
    setMarketLoading(true)
    center.start(t('progress.labels.marketing'), t('progress.logs.drafting'))
    center.setPhase('executing')
    try {
      await postJson('/api/entity/market', { channel, topic })
      setTopic('')
      await loadStatus()
      center.complete(t('toasts.draftCreated'))
    } catch (err) {
      center.fail(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setMarketLoading(false)
    }
  }, [channel, topic, loadStatus, center, t])

  const analyzeError = useCallback(async () => {
    if (!healTitle.trim()) return
    setHealLoading(true)
    center.start(t('progress.labels.healing'), t('progress.logs.diagnosing'))
    center.setPhase('executing')
    try {
      await postJson('/api/entity/heal', { title: healTitle, message: healMessage })
      setHealTitle('')
      setHealMessage('')
      await loadStatus()
      center.complete(t('toasts.healAnalyzed'))
    } catch (err) {
      center.fail(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setHealLoading(false)
    }
  }, [healTitle, healMessage, loadStatus, center, t])

  const recommendRevenue = useCallback(async () => {
    setRevenueLoading(true)
    center.start(t('progress.labels.revenue'), t('progress.logs.analyzingRevenue'))
    center.setPhase('executing')
    try {
      await postJson('/api/entity/revenue', {})
      await loadStatus()
      center.complete(t('toasts.recommendCreated'))
    } catch (err) {
      center.fail(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setRevenueLoading(false)
    }
  }, [loadStatus, center, t])

  const decide = useCallback(
    async (actionId: string, decision: 'approve' | 'reject' | 'rollback' | 'apply') => {
      setBusyId(actionId)
      center.start(t('progress.labels.decision'), t('progress.logs.deciding'))
      center.setPhase('executing')
      try {
        await postJson('/api/entity/action', { actionId, decision })
        await loadStatus()
        center.complete(t(`toasts.${decision}`))
      } catch (err) {
        center.fail(err instanceof Error ? err.message : t('errors.generic'))
      } finally {
        setBusyId(null)
      }
    },
    [loadStatus, center, t],
  )

  const scanNow = useCallback(async () => {
    setScanning(true)
    center.start(t('progress.labels.scan'), t('progress.logs.scanning'))
    center.setPhase('executing')
    try {
      await postJson('/api/entity/alerts', { op: 'scan' })
      await Promise.all([loadAlerts(), loadStatus()])
      center.complete(t('alerts.scanned'))
    } catch (err) {
      center.fail(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setScanning(false)
    }
  }, [loadAlerts, loadStatus, center, t])

  const decideAlert = useCallback(
    async (alertId: string, op: 'acknowledge' | 'dismiss') => {
      setAlertBusyId(alertId)
      try {
        await postJson('/api/entity/alerts', { op, alertId })
        toast.success(t(`alerts.${op === 'acknowledge' ? 'acknowledged' : 'dismissed'}`))
        await loadAlerts()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('errors.generic'))
      } finally {
        setAlertBusyId(null)
      }
    },
    [loadAlerts, t],
  )

  const stopped = status?.emergencyStopped ?? false
  const actions = status?.recentActions ?? []
  const pending = actions.filter((a) => a.status === 'pending')
  const openAlerts = alerts.filter((a) => a.status === 'open' || a.status === 'acknowledged')

  return (
    <div className="space-y-6">
      {/* Header + emergency stop */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStatus}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t('status.refresh')}
          </button>
          <button
            onClick={() => toggleStop(!stopped)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
              stopped ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {stopped ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {stopped ? t('emergencyStop.release') : t('emergencyStop.engage')}
          </button>
        </div>
      </div>

      {/* Safety note */}
      <div className="flex gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-gray-700 dark:text-gray-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>{t('safety.body')}</span>
      </div>

      {stopped && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {t('emergencyStop.engagedNotice')}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('status.pending')} value={status?.pendingApprovals ?? 0} loading={loading} />
        <StatCard label={t('status.totalActions')} value={status?.totalActions ?? 0} loading={loading} />
        <StatCard label={t('status.commands')} value={status?.recentCommands.length ?? 0} loading={loading} />
        <StatCard
          label={t('status.state')}
          value={stopped ? t('status.stopped') : t('status.running')}
          loading={loading}
        />
      </div>

      {/* Live progress + notifications */}
      <EntityProgress state={progress} onClear={() => center.clear()} />

      {/* Command runner */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('command.title')}</h2>
        </div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder={t('command.placeholder')}
          className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
        <button
          onClick={runCommand}
          disabled={commandLoading || stopped || !goal.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {commandLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {commandLoading ? t('command.running') : t('command.run')}
        </button>
        {plan && (
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">{plan.summary}</p>
            {plan.tasks.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-300">
                {plan.tasks.map((task) => (
                  <li key={task.id}>
                    <span className="font-medium">{task.title}</span>{' '}
                    <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${PERMISSION_STYLES[task.permission]}`}>
                      {task.module}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('command.empty')}</p>
            )}
          </div>
        )}
      </section>

      {/* Tools */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Marketing */}
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('marketing.title')}</h2>
          </div>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as (typeof MARKETING_CHANNELS)[number])}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            {MARKETING_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`marketing.channels.${c}`)}
              </option>
            ))}
          </select>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('marketing.topic')}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <button
            onClick={generateDraft}
            disabled={marketLoading || stopped || !topic.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {marketLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
            {marketLoading ? t('marketing.generating') : t('marketing.generate')}
          </button>
        </section>

        {/* Revenue */}
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('revenue.title')}</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('revenue.description')}</p>
          <button
            onClick={recommendRevenue}
            disabled={revenueLoading || stopped}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {revenueLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {revenueLoading ? t('revenue.generating') : t('revenue.recommend')}
          </button>
        </section>

        {/* Self-healing */}
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('healing.title')}</h2>
          </div>
          <input
            value={healTitle}
            onChange={(e) => setHealTitle(e.target.value)}
            placeholder={t('healing.errorTitle')}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <textarea
            value={healMessage}
            onChange={(e) => setHealMessage(e.target.value)}
            rows={2}
            placeholder={t('healing.message')}
            className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <button
            onClick={analyzeError}
            disabled={healLoading || stopped || !healTitle.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {healLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            {healLoading ? t('healing.analyzing') : t('healing.analyze')}
          </button>
        </section>
      </div>

      {/* Alerts (auto-detected issues) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('alerts.title')}</h2>
            {openAlerts.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {openAlerts.length}
              </span>
            )}
          </div>
          <button
            onClick={scanNow}
            disabled={scanning || stopped}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
            {scanning ? t('alerts.scanning') : t('alerts.scan')}
          </button>
        </div>
        {alertsLoading ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {t('alerts.scanning')}
          </p>
        ) : alerts.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {t('alerts.none')}
          </p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                busy={alertBusyId === alert.id}
                onAcknowledge={() => decideAlert(alert.id, 'acknowledge')}
                onDismiss={() => decideAlert(alert.id, 'dismiss')}
                labels={{
                  acknowledge: t('alerts.acknowledge'),
                  dismiss: t('alerts.dismiss'),
                  linkedFix: t('alerts.linkedFix'),
                  severity: t(`alerts.severity.${alert.severity}`),
                  source: t(`alerts.source.${alert.source}`),
                  statusLabel: t(`alerts.status.${alert.status}`),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pending approvals */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('approvals.title')}</h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {t('approvals.none')}
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                busy={busyId === action.id}
                onApprove={() => decide(action.id, 'approve')}
                onReject={() => decide(action.id, 'reject')}
                onRollback={() => decide(action.id, 'rollback')}
                onApply={() => decide(action.id, 'apply')}
                labels={{
                  approve: t('approvals.approve'),
                  reject: t('approvals.reject'),
                  rollback: t('approvals.rollback'),
                  apply: t('approvals.apply'),
                  applying: t('approvals.applying'),
                  viewPr: t('approvals.viewPr'),
                  permission: t(`permissions.${action.permission}`),
                  statusLabel: t(`statuses.${action.status}`),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Activity log */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('activity.title')}</h2>
        </div>
        {actions.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {t('activity.none')}
          </p>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                busy={busyId === action.id}
                onApprove={() => decide(action.id, 'approve')}
                onReject={() => decide(action.id, 'reject')}
                onRollback={() => decide(action.id, 'rollback')}
                onApply={() => decide(action.id, 'apply')}
                labels={{
                  approve: t('approvals.approve'),
                  reject: t('approvals.reject'),
                  rollback: t('approvals.rollback'),
                  apply: t('approvals.apply'),
                  applying: t('approvals.applying'),
                  viewPr: t('approvals.viewPr'),
                  permission: t(`permissions.${action.permission}`),
                  statusLabel: t(`statuses.${action.status}`),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{loading ? '—' : value}</p>
    </div>
  )
}

function ActionCard({
  action,
  busy,
  onApprove,
  onReject,
  onRollback,
  onApply,
  labels,
}: {
  action: EntityAction
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onRollback: () => void
  onApply: () => void
  labels: {
    approve: string
    reject: string
    rollback: string
    apply: string
    applying: string
    viewPr: string
    permission: string
    statusLabel: string
  }
}) {
  const preview = payloadPreview(action.payload)
  const canApply =
    action.status === 'approved' && action.type === 'healing.fix' && hasValidPatch(action.payload)
  const prUrl = typeof action.result?.prUrl === 'string' ? (action.result.prUrl as string) : null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{action.title}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{action.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PERMISSION_STYLES[action.permission]}`}>
            {labels.permission}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[action.status]}`}>
            {labels.statusLabel}
          </span>
        </div>
      </div>
      {preview && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-950 dark:text-gray-200">
          {preview}
        </pre>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action.status === 'pending' && (
          <>
            <button
              onClick={onApprove}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {labels.approve}
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <X className="h-3 w-3" /> {labels.reject}
            </button>
          </>
        )}
        {canApply && (
          <button
            onClick={onApply}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitPullRequest className="h-3 w-3" />}{' '}
            {busy ? labels.applying : labels.apply}
          </button>
        )}
        {action.status === 'executed' && (
          <>
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
              >
                <ExternalLink className="h-3 w-3" /> {labels.viewPr}
              </a>
            )}
            <button
              onClick={onRollback}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} {labels.rollback}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function AlertCard({
  alert,
  busy,
  onAcknowledge,
  onDismiss,
  labels,
}: {
  alert: EntityAlert
  busy: boolean
  onAcknowledge: () => void
  onDismiss: () => void
  labels: {
    acknowledge: string
    dismiss: string
    linkedFix: string
    severity: string
    source: string
    statusLabel: string
  }
}) {
  const actionable = alert.status === 'open' || alert.status === 'acknowledged'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{alert.title}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {new Date(alert.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ALERT_SEVERITY_STYLES[alert.severity]}`}>
            {labels.severity}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {labels.source}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {labels.statusLabel}
          </span>
        </div>
      </div>
      {alert.linkedActionId && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-700 dark:text-indigo-300">
          <Wrench className="h-3 w-3" /> {labels.linkedFix}
        </p>
      )}
      {actionable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {alert.status === 'open' && (
            <button
              onClick={onAcknowledge}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {labels.acknowledge}
            </button>
          )}
          <button
            onClick={onDismiss}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <EyeOff className="h-3 w-3" />} {labels.dismiss}
          </button>
        </div>
      )}
    </div>
  )
}

export default function EntityPage() {
  return (
    <RoleGuard requiredRole="admin" fallback={<div className="text-red-600">Access denied.</div>}>
      <EntityContent />
    </RoleGuard>
  )
}
