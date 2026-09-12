'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, ScanSearch, Loader2 } from 'lucide-react'

function ScanPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const connected = params.get('connected') === '1'
  const error = params.get('error')

  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ detected: number } | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  async function runScan() {
    setScanning(true)
    setScanError(null)
    setScanResult(null)
    try {
      const res = await fetch('/api/gmail/scan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setScanResult({ detected: data.detected })
      setTimeout(() => router.push('/dashboard/subscriptions'), 2000)
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {connected && !scanResult && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Gmail connected!</p>
              <p className="text-sm">Now scan your inbox for subscriptions.</p>
            </div>
          </div>
        )}

        {scanResult && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Scan complete!</p>
              <p className="text-sm">Found {scanResult.detected} subscriptions. Redirecting…</p>
            </div>
          </div>
        )}

        {(error || scanError) && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{scanError || decodeURIComponent(error || '')}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <Mail className="mx-auto mb-4 h-12 w-12 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {connected ? 'Scan your inbox' : 'Connect your Gmail'}
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {connected
              ? 'Searches the last 12 months for subscription receipts. Takes ~30 seconds.'
              : 'We scan your inbox for subscription receipts. Read-only. We never send emails.'}
          </p>

          {connected ? (
            <button
              onClick={runScan}
              disabled={scanning}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Scanning your inbox…
                </>
              ) : (
                <>
                  <ScanSearch className="h-5 w-5" />
                  Run scan now
                </>
              )}
            </button>
          ) : (
            <a
              href="/api/gmail/connect"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
            >
              <Mail className="h-5 w-5" />
              Connect Gmail
            </a>
          )}

          {connected && (
            <p className="mt-4 text-xs text-gray-400">
              Connected as f3027075@gmail.com ·{' '}
              <a href="/api/gmail/connect" className="underline">
                reconnect
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <ScanPageInner />
    </Suspense>
  )
}
