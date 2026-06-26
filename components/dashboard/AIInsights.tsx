'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ArrowRight,
  Activity,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import { AnimatedNumber, TrendChip, Sparkline } from './primitives'
import type {
  ForecastResult,
  AnomalyPoint,
  Recommendation,
  RecommendationSeverity,
} from '@/lib/dashboard/insights'

export interface AIInsightsProps {
  forecast: ForecastResult
  anomalies: AnomalyPoint[]
  recommendations: Recommendation[]
  currency?: string
  monthlySeries?: { label: string; value: number }[]
}

const SEVERITY_STYLES: Record<
  RecommendationSeverity,
  { icon: typeof Info; chip: string; dot: string }
> = {
  critical: { icon: AlertTriangle, chip: 'text-red-400', dot: 'bg-red-400' },
  warning: { icon: AlertCircle, chip: 'text-amber-400', dot: 'bg-amber-400' },
  info: { icon: Info, chip: 'text-accent', dot: 'bg-accent' },
  success: { icon: CheckCircle2, chip: 'text-success', dot: 'bg-success' },
}

/**
 * AI insights panel: a revenue forecast (linear regression), anomaly detection
 * (z-score) and rule-based smart recommendations. Presentation only — all
 * computation is done by `lib/dashboard/insights` and passed in as props.
 */
export default function AIInsights({
  forecast,
  anomalies,
  recommendations,
  currency = 'USD',
  monthlySeries = [],
}: AIInsightsProps) {
  const t = useTranslations('dashboard')
  const router = useRouter()

  const money = (value: number) => `${currency} ${Math.round(value).toLocaleString()}`
  const trendLabel =
    forecast.trend === 'up'
      ? t('ai.forecast.trendUp')
      : forecast.trend === 'down'
        ? t('ai.forecast.trendDown')
        : t('ai.forecast.trendFlat')
  const spark = monthlySeries.map((p) => p.value)

  return (
    <Card hoverGlow={false} className="relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-button bg-gradient-to-br from-accent to-accent-secondary text-white shadow-glow-sm">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className="font-semibold leading-tight text-text-primary">{t('ai.title')}</h2>
              <p className="text-xs text-text-secondary">{t('ai.subtitle')}</p>
            </div>
          </div>
          <span className="hidden rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent sm:inline">
            {t('ai.poweredBy')}
          </span>
        </div>

        {/* Revenue forecast */}
        <div className="rounded-card border border-border bg-surface/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-text-secondary">{t('ai.forecast.title')}</p>
            {forecast.sufficient && <TrendChip trend={forecast.trend} label={trendLabel} />}
          </div>

          {forecast.sufficient ? (
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-text-primary">
                  <AnimatedNumber value={forecast.forecast} prefix={`${currency} `} />
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {t('ai.forecast.nextMonth')} ·{' '}
                  {t('ai.forecast.confidence', { value: Math.round(forecast.confidence * 100) })}
                </p>
              </div>
              {spark.length > 1 && (
                <Sparkline data={spark} stroke="#9333EA" className="h-9 w-28 shrink-0 opacity-80" />
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">{t('ai.forecast.insufficient')}</p>
          )}
        </div>

        {/* Anomaly detection */}
        <div className="mt-3 rounded-card border border-border bg-surface/40 p-4">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <p className="text-xs uppercase tracking-wide text-text-secondary">{t('ai.anomaly.title')}</p>
          </div>
          {anomalies.length === 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-secondary">
              <CheckCircle2 size={14} className="text-success" />
              {t('ai.anomaly.none')}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {anomalies.slice(0, 3).map((a) => (
                <li key={a.index} className="flex items-center gap-2 text-sm">
                  {a.direction === 'spike' ? (
                    <TrendingUp size={15} className="shrink-0 text-success" />
                  ) : (
                    <TrendingDown size={15} className="shrink-0 text-red-400" />
                  )}
                  <span className="text-text-primary">
                    {a.direction === 'spike' ? t('ai.anomaly.spike') : t('ai.anomaly.drop')}
                  </span>
                  <span className="text-text-secondary">
                    · {a.label} · {money(a.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Smart recommendations */}
        <div className="mt-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">{t('ai.recommendations.title')}</p>
          <ul className="space-y-2">
            {recommendations.map((rec) => {
              const style = SEVERITY_STYLES[rec.severity]
              const Icon = style.icon
              const params = rec.params
                ? { ...rec.params, ...(typeof rec.params.amount === 'number' ? { amount: money(rec.params.amount) } : {}) }
                : undefined
              return (
                <li
                  key={rec.id}
                  className="flex items-start gap-2.5 rounded-button border border-border bg-surface/30 p-3"
                >
                  <Icon size={16} className={`mt-0.5 shrink-0 ${style.chip}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{t(`ai.recommendations.${rec.messageKey}`, params)}</p>
                    {rec.href && rec.actionKey && (
                      <button
                        onClick={() => router.push(rec.href!)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-secondary"
                      >
                        {t(`ai.recommendations.actions.${rec.actionKey}`)}
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Card>
  )
}
