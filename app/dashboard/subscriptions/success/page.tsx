'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function SuccessInner() {
  const params = useSearchParams()
  const router = useRouter()
  const sessionId = params.get('session_id')
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setState('error')
      setError('No session ID provided.')
      return
    }

    let attempts = 0
    const maxAttempts = 10

    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState('error')
        setError('Please log in to verify your purchase.')
        return
      }

      // Ask our API to verify the Stripe session and mark as paid
      const res = await fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      const data = await res.json()

      if (data.ok) {
        setState('success')
        setTimeout(() => router.push('/dashboard/subscriptions'), 2500)
        return
      }

      // If the webhook hasn't landed yet, retry
      attempts++
      if (attempts < maxAttempts) {
        setTimeout(check, 1500)
      } else {
        setState('error')
        setError(data.error || 'Could not verify purchase. Contact support@subremoval.com')
      }
    }

    check()
  }, [sessionId, router])

  return (
    <div className="p-6 md:p-8 min-h-screen flex items-center justify-center">
      <div className="max-w-md text-center">
        {state === 'verifying' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-purple-600" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Verifying your payment…</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This usually takes 3–5 seconds.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">You&apos;re in! 🎉</h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              Lifetime access unlocked. Redirecting to your dashboard…
            </p>
            <Link
              href="/dashboard/subscriptions"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
            >
              Go now
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <p className="mt-3 text-xs text-gray-400">
              If you were charged but don&apos;t see access, email support@subremoval.com with your receipt.
              We&apos;ll fix it within 2 business days.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Try again
              </button>
              <Link
                href="/dashboard/subscriptions"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Back to dashboard
              </Link>
              <a
                href="mailto:support@subremoval.com"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white underline"
              >
                Email support
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  )
}
