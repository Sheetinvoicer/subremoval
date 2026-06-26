'use client'

import { Sparkles, type LucideIcon } from 'lucide-react'
import Card from '@/components/ui/Card'
import { AnimatedNumber, ChangeIndicator, Sparkline } from './primitives'

export interface MetricCardProps {
  label: string
  value: number
  prefix?: string
  /** Month-over-month change, percent. */
  change?: number
  /** AI-predicted value for the next period. */
  predicted?: number
  /** Localised "AI prediction" caption. */
  predictionLabel?: string
  /** Localised "vs last month" caption. */
  vsLabel?: string
  icon: LucideIcon
  iconClass?: string
  /** Sparkline series (small history). */
  spark?: number[]
  onClick?: () => void
}

/**
 * Key-metric card with an animated value, MoM delta, a sparkline and an
 * AI-predicted next-period figure. Pure presentation — all numbers come from
 * the page that owns the data.
 */
export default function MetricCard({
  label,
  value,
  prefix = '',
  change,
  predicted,
  predictionLabel,
  vsLabel,
  icon: Icon,
  iconClass = 'text-accent bg-accent/10',
  spark,
  onClick,
}: MetricCardProps) {
  return (
    <Card onClick={onClick} className={onClick ? 'group cursor-pointer' : 'group'}>
      <div className="flex items-start justify-between">
        <div className={`rounded-button p-2 ${iconClass}`}>
          <Icon size={20} />
        </div>
        {typeof change === 'number' && <ChangeIndicator change={change} />}
      </div>

      <p className="mt-4 text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">
        <AnimatedNumber value={value} prefix={prefix} />
      </p>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {vsLabel && <p className="text-[11px] text-text-secondary">{vsLabel}</p>}
          {typeof predicted === 'number' && predictionLabel && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent">
              <Sparkles size={11} className="shrink-0" />
              <span className="truncate">
                {predictionLabel}: {prefix}
                {Math.round(predicted).toLocaleString()}
              </span>
            </p>
          )}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline
            data={spark}
            stroke="#9333EA"
            className="h-7 w-20 shrink-0 opacity-70 transition-opacity duration-250 group-hover:opacity-100"
          />
        )}
      </div>
    </Card>
  )
}
