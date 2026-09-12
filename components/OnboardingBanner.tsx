'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, ScanSearch, XCircle, ArrowRight, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  hasSubscriptions: boolean
}

export default function OnboardingBanner({ hasSubscriptions }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If dismissed in localStorage, hide
    if (typeof window !== 'undefined' && localStorage.getItem('sr_onboarding_dismissed') === '1') {
      setDismissed(true)
    }

    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Gmail connected?
      const { data: tokenRow } = await supabase
        .from('sr_gmail_tokens')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      setGmailConnected(!!tokenRow)

      // Scan done? Check if user has ever scanned (any row in sr_detected_subscriptions)
      const { count } = await supabase
        .from('sr_detected_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setScanDone((count ?? 0) > 0)
      setLoading(false)
    })()
  }, [])

  function dismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sr_onboarding_dismissed', '1')
    }
    setDismissed(true)
  }

  // Hide if loading, dismissed, or user already has subscriptions
  if (loading || dismissed || hasSubscriptions) return null

  const step1Done = gmailConnected
  const step2Done = scanDone
  const step3Done = hasSubscriptions

  return (
    <div className="mb-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-gray-900/40 p-6 relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <X size={18} />
      </button>

      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">👋 Welcome to SubRemoval</h2>
        <p className="mt-1 text-sm text-gray-400">
          Find your forgotten subscriptions in 3 steps. Takes ~1 minute.
        </p>
      </div>

      <div className="space-y-4">
        {/* STEP 1 */}
        <div className="flex items-start gap-4">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
            step1Done ? 'bg-green-500 text-white' : 'bg-purple-600 text-white'
          }`}>
            {step1Done ? <Check size={16} /> : '1'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold ${step1Done ? 'text-gray-400 line-through' : 'text-white'}`}>
                Connect your Gmail
              </h3>
            </div>
            <p className="mt-0.5 text-sm text-gray-400">
              Read-only access. We can scan receipts but never send, delete, or read anything else.
            </p>
            {!step1Done && (
              <a
                href="/api/gmail/connect"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                <Mail size={15} />
                Connect Gmail
                <ArrowRight size={14} />
              </a>
            )}
          </div>
        </div>

        {/* STEP 2 */}
        <div className="flex items-start gap-4">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
            step2Done ? 'bg-green-500 text-white' :
            step1Done ? 'bg-purple-600 text-white' :
            'bg-gray-700 text-gray-400'
          }`}>
            {step2Done ? <Check size={16} /> : '2'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold ${
              step2Done ? 'text-gray-400 line-through' :
              step1Done ? 'text-white' :
              'text-gray-500'
            }`}>
              Run your first scan
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              Takes ~30 seconds. Finds every subscription you pay for.
            </p>
            {!step2Done && step1Done && (
              <Link
                href="/dashboard/subscriptions/scan"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                <ScanSearch size={15} />
                Run scan now
                <ArrowRight size={14} />
              </Link>
            )}
            {!step1Done && (
              <p className="mt-2 text-xs text-gray-500 italic">
                Complete step 1 first
              </p>
            )}
          </div>
        </div>

        {/* STEP 3 */}
        <div className="flex items-start gap-4">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
            step3Done ? 'bg-green-500 text-white' :
            step2Done ? 'bg-purple-600 text-white' :
            'bg-gray-700 text-gray-400'
          }`}>
            {step3Done ? <Check size={16} /> : '3'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold ${
              step3Done ? 'text-gray-400 line-through' :
              step2Done ? 'text-white' :
              'text-gray-500'
            }`}>
              Cancel what you don't need
            </h3>
            <p className="mt-0.5 text-sm text-gray-400">
              We give you direct links to each service's cancel page. Cancel in 2 clicks.
            </p>
            {!step3Done && step2Done && (
              <Link
                href="/dashboard/subscriptions"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-purple-500/40 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/10 transition-colors"
              >
                <XCircle size={15} />
                See subscriptions
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={dismiss}
        className="mt-5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
      >
        Skip for now — I&apos;ll figure it out
      </button>
    </div>
  )
}
