'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import {
  Sparkles,
  AlertTriangle,
  Users,
  Activity,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import RoleGuard from '@/components/RoleGuard'
import AdminAIAssistant from '@/components/AdminAIAssistant'
import { Skeleton } from '@/components/LoadingSkeleton'

type Role = 'admin' | 'staff' | 'viewer'

interface Metrics {
  totalUsers: number
  usersByRole: Record<Role, number>
  newUsers30d: number
  activeUsers30d: number
  totalClients: number
  totalInvoices: number
  paidInvoices: number
  overdueInvoices: number
  totalRevenue: number
  pendingRevenue: number
  totalExpenses: number
  auditEvents: number
  auditEvents24h: number
}

interface ActivityUser {
  userId: string | null
  email: string | null
  actions: number
  lastActiveAt: string | null
  topActions: { action: string; count: number }[]
}

interface ActivitySummary {
  totalActions: number
  actionsByType: { action: string; count: number }[]
  topUsers: ActivityUser[]
  windowDays: number
}

type Severity = 'low' | 'medium' | 'high'

interface Anomaly {
  id: string
  severity: Severity
  title: string
  detail: string
  userEmail?: string | null
  metric?: number
}

interface RoleSuggestion {
  userId: string
  email: string | null
  currentRole: Role
  suggestedRole: Role
  reason: string
}

interface Recommendations {
  roleSuggestions: RoleSuggestion[]
  featureRecommendations: string[]
  invoiceOptimizationTips: string[]
  aiTips?: string
}

interface AnalyticsPayload {
  generatedAt: string
  metrics: Metrics
  activity: ActivitySummary
  anomalies: Anomaly[]
}

const SEVERITY_STYLES: Record<Severity, string> = {
  high: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300',
  medium:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300',
  low: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function AdminAIContent() {
  const t = useTranslations('adminAi')

  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [report, setReport] = useState<string>('')
  const [reportLoading, setReportLoading] = useState(false)
  const [tipsLoading, setTipsLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [analyticsRes, recommendationsRes] = await Promise.all([
        fetch('/api/admin/ai/analytics', { cache: 'no-store' }),
        fetch('/api/admin/ai/recommendations', { cache: 'no-store' }),
      ])

      const analyticsPayload = await analyticsRes.json().catch(() => null)
      if (!analyticsRes.ok) {
        throw new Error(analyticsPayload?.error || t('error'))
      }
      setAnalytics(analyticsPayload)

      const recommendationsPayload = await recommendationsRes.json().catch(() => null)
      if (recommendationsRes.ok) {
        setRecommendations(recommendationsPayload?.recommendations || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const generateReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const res = await fetch('/api/admin/ai/analytics', { method: 'POST' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error || t('report.error'))
      }
      setReport(payload?.report || '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('report.error'))
    } finally {
      setReportLoading(false)
    }
  }, [t])

  const generateTips = useCallback(async () => {
    setTipsLoading(true)
    try {
      const res = await fetch('/api/admin/ai/recommendations?ai=1', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error || t('error'))
      }
      setRecommendations(payload?.recommendations || null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setTipsLoading(false)
    }
  }, [t])

  const applyRole = useCallback(
    async (userId: string, role: Role) => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role }),
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(payload?.error || t('error'))
        }
        toast.success(t('recommendations.roles.applied'))
        setRecommendations((prev) =>
          prev
            ? { ...prev, roleSuggestions: prev.roleSuggestions.filter((s) => s.userId !== userId) }
            : prev
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('error'))
      }
    },
    [t]
  )

  const metrics = analytics?.metrics

  const metricCards = metrics
    ? [
        { label: t('metrics.totalUsers'), value: metrics.totalUsers },
        { label: t('metrics.activeUsers'), value: metrics.activeUsers30d },
        { label: t('metrics.totalInvoices'), value: metrics.totalInvoices },
        { label: t('metrics.overdueInvoices'), value: metrics.overdueInvoices },
        { label: t('metrics.totalRevenue'), value: formatCurrency(metrics.totalRevenue) },
        { label: t('metrics.pendingRevenue'), value: formatCurrency(metrics.pendingRevenue) },
        { label: t('metrics.totalClients'), value: metrics.totalClients },
        { label: t('metrics.events24h'), value: metrics.auditEvents24h },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Usage insights dashboard */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('metrics.title')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-6 w-16" />
                </div>
              ))
            : metricCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                </div>
              ))}
        </div>
        {metrics && (
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
              <ShieldCheck className="h-3 w-3" /> {t('metrics.admins')}: {metrics.usersByRole.admin}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {t('metrics.staff')}: {metrics.usersByRole.staff}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {t('metrics.viewers')}: {metrics.usersByRole.viewer}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {t('metrics.newUsers')}: {metrics.newUsers30d}
            </span>
          </div>
        )}
      </section>

      {/* Anomaly detection alerts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('anomalies.title')}</h2>
        </div>
        {loading ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : analytics && analytics.anomalies.length > 0 ? (
          <div className="space-y-2">
            {analytics.anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${SEVERITY_STYLES[anomaly.severity]}`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">
                    {anomaly.title}
                    <span className="ml-2 rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase tracking-wide dark:bg-black/20">
                      {t(`anomalies.severity.${anomaly.severity}`)}
                    </span>
                  </p>
                  <p className="text-xs opacity-90">{anomaly.detail}</p>
                  {anomaly.userEmail && <p className="mt-1 text-[11px] opacity-75">{anomaly.userEmail}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {t('anomalies.none')}
          </p>
        )}
      </section>

      {/* Smart recommendations */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('recommendations.title')}
            </h2>
          </div>
          <button
            onClick={generateTips}
            disabled={tipsLoading || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {tipsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t('recommendations.aiTips.generate')}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Role suggestions */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('recommendations.roles.title')}
              </h3>
            </div>
            {recommendations && recommendations.roleSuggestions.length > 0 ? (
              <ul className="space-y-3">
                {recommendations.roleSuggestions.map((suggestion) => (
                  <li key={suggestion.userId} className="text-sm">
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                      {suggestion.email || suggestion.userId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.reason}</p>
                    <button
                      onClick={() => applyRole(suggestion.userId, suggestion.suggestedRole)}
                      className="mt-1 inline-flex items-center gap-1 rounded-md border border-accent px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
                    >
                      {t('recommendations.roles.apply', { role: suggestion.suggestedRole })}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.roles.none')}</p>
            )}
          </div>

          {/* Feature recommendations */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('recommendations.features.title')}
              </h3>
            </div>
            {recommendations && recommendations.featureRecommendations.length > 0 ? (
              <ul className="list-disc space-y-2 pl-4 text-xs text-gray-600 dark:text-gray-300">
                {recommendations.featureRecommendations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.features.none')}</p>
            )}
          </div>

          {/* Invoice optimization tips */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('recommendations.invoices.title')}
              </h3>
            </div>
            {recommendations && recommendations.invoiceOptimizationTips.length > 0 ? (
              <ul className="list-disc space-y-2 pl-4 text-xs text-gray-600 dark:text-gray-300">
                {recommendations.invoiceOptimizationTips.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.invoices.none')}</p>
            )}
          </div>
        </div>

        {recommendations?.aiTips && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('recommendations.aiTips.title')}
              </h3>
            </div>
            <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
              {recommendations.aiTips}
            </div>
          </div>
        )}
      </section>

      {/* User activity analysis */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('activity.title')}</h2>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : analytics && analytics.activity.topUsers.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">{t('activity.user')}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t('activity.actions')}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t('activity.topActions')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.activity.topUsers.map((user, index) => (
                  <tr key={user.userId || index} className="border-t border-gray-200 dark:border-gray-800">
                    <td className="px-4 py-2">{user.email || user.userId || '-'}</td>
                    <td className="px-4 py-2">{user.actions}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {user.topActions.map((action) => `${action.action} (${action.count})`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {t('activity.none')}
          </p>
        )}
      </section>

      {/* Auto-generated admin report */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('report.title')}</h2>
          </div>
          <button
            onClick={generateReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {reportLoading ? t('report.generating') : t('report.generate')}
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          {report ? (
            <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{report}</div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('report.empty')}</p>
          )}
        </div>
      </section>

      {/* Admin AI chat / search */}
      <section className="space-y-3">
        <AdminAIAssistant />
      </section>
    </div>
  )
}

export default function AdminAIPage() {
  return (
    <RoleGuard requiredRole="admin" fallback={<div className="text-red-600">Access denied.</div>}>
      <AdminAIContent />
    </RoleGuard>
  )
}
