'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanSearch, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import OnboardingBanner from '@/components/OnboardingBanner'

interface Sub {
  id: string
  service_name: string
  amount: number | null
  currency: string | null
  billing_cycle: string | null
  status: string
  cancel_url: string | null
  confidence: 'high' | 'medium' | 'low' | null
  last_payment_status: string | null
}

const FX: Record<string, number> = { USD: 1, EUR: 1.085, GBP: 1.27, JPY: 0.0067 }

const BRAND_COLORS = [
  '#E50914','#1DB954','#5865F2','#FF7A00','#6E56CF',
  '#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6',
  '#EC4899','#14B8A6','#F97316','#6366F1',
]

function brandColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return BRAND_COLORS[Math.abs(h) % BRAND_COLORS.length]
}

function getInitials(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function toUSD(amount: number | null, currency: string | null) {
  if (amount == null) return 0
  return amount * (FX[currency ?? 'USD'] ?? 1)
}

function money(amount: number | null, currency: string | null) {
  if (amount == null) return null
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  return `${symbol}${amount.toFixed(2)}`
}

export default function DashboardPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('You must be logged in.'); setLoading(false); return }
      const { data, error } = await supabase
        .from('sr_detected_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_seen_at', { ascending: false })
      if (error) setError(error.message)
      else setSubs((data ?? []) as Sub[])
      setLoading(false)
    })()
  }, [])

  const active = subs.filter((s) => s.status !== 'cancelled' && s.status !== 'dismissed')
  const monthlyUSD = active.reduce((sum, s) => {
    const usd = toUSD(s.amount, s.currency)
    return sum + (s.billing_cycle === 'yearly' ? usd / 12 : usd)
  }, 0)
  const annualUSD = monthlyUSD * 12
  const needsReview = active.filter((s) => s.confidence && s.confidence !== 'high').length
  const failures = active.filter((s) => s.last_payment_status === 'failed')
  const topSpenders = [...active]
    .filter((s) => s.amount != null)
    .sort((a, b) => toUSD(b.amount, b.currency) - toUSD(a.amount, a.currency))
    .slice(0, 3)

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Your subscription overview
            </p>
          </div>
          <Link
            href="/dashboard/subscriptions/scan"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            <ScanSearch className="h-4 w-4" />
            Rescan inbox
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && <OnboardingBanner hasSubscriptions={active.length > 0} />}

        {/* EMPTY STATE */}
        {!loading && active.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
            <ScanSearch className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white">No subscriptions found yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect your Gmail and run your first scan.
            </p>
            <Link
              href="/dashboard/subscriptions/scan"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              Start scanning
            </Link>
          </div>
        )}

        {/* HERO */}
        {!loading && active.length > 0 && (
          <>
            <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-gray-800 p-8 dark:border-gray-700">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                You&apos;re paying
              </p>
              <p className="mt-3 text-5xl font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: -2 }}>
                ${monthlyUSD.toFixed(2)}
                <span className="ml-2 text-lg font-medium text-gray-400">/mo</span>
              </p>
              <p className="mt-2 text-lg text-gray-300">
                That&apos;s <strong className="text-white">${annualUSD.toFixed(0)}</strong> per year — across {active.length} subscriptions
              </p>

              {failures.length > 0 && (
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <p className="font-semibold text-red-300">
                      {failures.length} payment {failures.length === 1 ? 'issue' : 'issues'} detected
                    </p>
                    <p className="mt-0.5 text-sm text-red-200/80">
                      {failures.map((f) => f.service_name).join(' · ')} — check your card
                    </p>
                  </div>
                </div>
              )}

              {needsReview > 0 && failures.length === 0 && (
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <p className="text-sm text-amber-200/90">
                    <strong>{needsReview}</strong> {needsReview === 1 ? 'subscription needs' : 'subscriptions need'} review
                  </p>
                </div>
              )}
            </div>

            {/* TOP SPENDERS */}
            {topSpenders.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Top spenders
                </h2>
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                  {topSpenders.map((s, idx) => {
                    const usd = toUSD(s.amount, s.currency)
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-4 px-5 py-4 ${idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                          style={{ background: brandColor(s.service_name) }}
                        >
                          {getInitials(s.service_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{s.service_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{s.billing_cycle ?? 'monthly'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold text-gray-900 dark:text-white">
                            {money(s.amount, s.currency)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ${usd.toFixed(2)}/mo
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ALL SUBSCRIPTIONS LINK */}
            <Link
              href="/dashboard/subscriptions"
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 hover:border-purple-400 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-500"
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">All subscriptions</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {active.length} tracked · {needsReview} need review
                </p>
              </div>
              <ExternalLink className="h-5 w-5 text-gray-400" />
            </Link>
          </>
        )}

        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        )}
      </div>
    </div>
  )
}
