'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface GmailStatus {
  connected: boolean
  email: string | null
}

export default function SettingsPage() {
  const [gmail, setGmail] = useState<GmailStatus>({ connected: false, email: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('Free')

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setError('You must be logged in.'); setLoading(false); return }

      const { data: tokenRow } = await supabase
        .from('sr_gmail_tokens')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      const { data: paid } = await supabase
        .from('sr_paid_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      setGmail({ connected: !!tokenRow, email: session.user.email ?? null })
      setPlan(paid ? 'Lifetime' : 'Free')
      setLoading(false)
    })()
  }, [])

  async function disconnectGmail() {
    if (!confirm('Disconnect Gmail? You will need to reconnect to scan again.')) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('sr_gmail_tokens').delete().eq('user_id', session.user.id)
    setGmail({ connected: false, email: gmail.email })
  }

  async function deleteAccount() {
    if (!confirm('This will permanently delete your account and all data. Continue?')) return
    if (!confirm('Last chance — are you absolutely sure?')) return
    const res = await fetch('/api/gdpr/delete', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/'
    } else {
      alert('Failed to delete account. Please contact support.')
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

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Manage your Gmail connection, billing, and account.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gmail connection</h2>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : gmail.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Connected as <strong>{gmail.email}</strong></span>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/gmail/connect"
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Reconnect
                </a>
                <button
                  onClick={disconnectGmail}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Not connected.</p>
              <a
                href="/api/gmail/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <Mail className="h-4 w-4" />
                Connect Gmail
              </a>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current plan</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{plan}</p>
            </div>
            {plan === 'Free' && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Upgrade — $4.99 once
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/10">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Danger zone</h2>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">
            Permanently delete your account and all detected subscriptions. This cannot be undone.
          </p>
          <button
            onClick={deleteAccount}
            className="inline-flex items-center gap-2 rounded-lg border border-red-400 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        </section>
      </div>
    </div>
  )
}
