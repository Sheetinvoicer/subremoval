'use client'

import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Trend } from '@/lib/dashboard/insights'

/**
 * Shared presentational primitives for the dashboard widgets.
 *
 * Kept here so the dashboard page and the `components/dashboard/*` widgets all
 * render numbers, deltas and sparklines consistently (and so the count-up
 * animation is defined once).
 */

/** Number that smoothly counts up on mount / value change. */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 900,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const from = 0
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

/** Small up/down/flat delta pill. */
export function ChangeIndicator({ change, className = '' }: { change: number; className?: string }) {
  const flat = Math.abs(change) < 0.5
  const positive = change >= 0
  const tone = flat ? 'text-text-secondary' : positive ? 'text-success' : 'text-red-400'
  const Icon = flat ? Minus : positive ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone} ${className}`}>
      <Icon size={12} />
      {Math.abs(change).toFixed(0)}%
    </span>
  )
}

/** Tiny inline SVG sparkline. Renders nothing for fewer than 2 points. */
export function Sparkline({
  data,
  className = '',
  stroke = 'currentColor',
}: {
  data: number[]
  className?: string
  stroke?: string
}) {
  if (!data || data.length < 2) return null
  const w = 100
  const h = 28
  const pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad)
      const y = h - pad - ((v - min) / range) * (h - 2 * pad)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Trend chip with an icon + label, themed by direction. */
export function TrendChip({ trend, label }: { trend: Trend; label: string }) {
  const tone =
    trend === 'up'
      ? 'bg-success/15 text-success'
      : trend === 'down'
        ? 'bg-red-400/15 text-red-400'
        : 'bg-surface text-text-secondary'
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}
