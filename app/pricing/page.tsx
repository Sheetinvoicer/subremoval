'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Check, Sparkles, Shield, Zap, CreditCard } from 'lucide-react'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buyLifetime() {
    setLoading(true)
    setError(null)
    try {
      // Check login FIRST
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Send them to signup, then back here
        router.push('/login?next=/pricing')
        return
      }

      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      // Already paid — send them to their dashboard
      if (res.status === 400 && data.error && data.error.includes('already have lifetime access')) {
        router.push('/dashboard/subscriptions')
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start checkout')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-900/30 px-4 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 mb-6">
            <Sparkles className="h-4 w-4" />
            Pay once. Use forever.
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Stop bleeding money in silence
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Find every forgotten subscription. Two ways to scan — <strong className="text-gray-900 dark:text-white">connect Gmail</strong> for automatic detection, or <strong className="text-gray-900 dark:text-white">upload a bank statement</strong> with no Gmail access.
          </p>
        </div>

        {/* PRICE CARD */}
        <div className="max-w-lg mx-auto">
          <div className="relative rounded-3xl border-2 border-purple-500 bg-white dark:bg-gray-900 p-8 shadow-2xl">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Launch price
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium uppercase tracking-wide">SubRemoval Lifetime</span>
              </div>

              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-bold text-gray-900 dark:text-white">$4.99</span>
                <span className="text-lg text-gray-500 dark:text-gray-400 line-through">$39</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                One payment. No subscription. Ever.
              </p>
            </div>

            <ul className="mt-8 space-y-3">
              {[
                'Scans Gmail OR bank statements',
                'Finds every forgotten charge',
                '3 scans per month, forever',
                'Direct cancel links for each service',
                'Payment failure warnings',
                'No monthly fee, no auto-renew',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={buyLifetime}
              disabled={loading}
              className="mt-8 w-full rounded-xl bg-purple-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
            >
              {loading ? 'Redirecting to checkout…' : 'Get lifetime access — $4.99'}
            </button>

            {error && (
              <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <p className="mt-4 text-center text-xs text-gray-400">
              Secure checkout via Stripe · 30-day money-back guarantee
            </p>
            <p className="mt-2 text-center text-xs text-gray-500">
              Full refund if you haven&apos;t scanned or if we find nothing — no questions asked.
            </p>
          </div>
        </div>

        {/* TRUST BLOCK */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">Privacy first</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Read-only Gmail or upload a statement. We never send or delete emails.
            </p>
          </div>
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">Results in 30 seconds</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect Gmail or upload a statement. See results in 30 seconds.
            </p>
          </div>
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <CreditCard className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">Pay once</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No recurring charges. No auto-renew. You hate subscriptions — so do we.
            </p>
          </div>
        </div>

        {/* BACK LINK */}
        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
