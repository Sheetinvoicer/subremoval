'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePlan } from '@/hooks/usePlan'
import { FEATURES } from '@/lib/subscriptions/plans'
import FeatureGate from '@/components/FeatureGate'
import UpgradePrompt from '@/components/UpgradePrompt'

interface TeamMember {
  id: string
  member_email: string
  role?: string
  status?: string
}

interface SsoConnection {
  id: string
  domain: string
  status?: string
}

const cardClass =
  'mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6'
const inputClass =
  'flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white'
const buttonClass =
  'px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60'

function TeamSection() {
  const tt = useTranslations('subscriptionPlans.team')
  const { getLimit, loading } = usePlan()
  const seatLimit = getLimit('teamMembers') as number | null
  const teamEnabled = seatLimit === null || seatLimit > 1

  const [members, setMembers] = useState<TeamMember[]>([])
  const [seats, setSeats] = useState<{ used: number; limit: number | null } | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/team')
      if (!res.ok) return
      const data = await res.json()
      setMembers(data.members || [])
      setSeats(data.seats || null)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!loading && teamEnabled) load()
  }, [loading, teamEnabled])

  async function invite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmail('')
        await load()
      } else {
        setError(data.error || tt('seatLimitReached'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await fetch(`/api/team?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await load()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  if (!teamEnabled) {
    return (
      <section className={cardClass}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{tt('title')}</h2>
        <UpgradePrompt message={tt('seatLimitReached')} />
      </section>
    )
  }

  const seatText =
    seats && seats.limit === null
      ? tt('seatsUnlimited')
      : seats
        ? tt('seatsUsed', { used: seats.used, total: seats.limit })
        : ''

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tt('title')}</h2>
        {seatText && <span className="text-sm text-gray-500 dark:text-gray-400">{seatText}</span>}
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-4">{tt('description')}</p>

      <form onSubmit={invite} className="flex gap-2 mb-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tt('inviteEmail')}
          className={inputClass}
        />
        <button type="submit" disabled={busy} className={buttonClass}>
          {tt('invite')}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {members.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{tt('empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-200">{m.member_email}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {m.status === 'active' ? tt('active') : tt('pending')}
                </span>
                <button
                  onClick={() => remove(m.id)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline disabled:opacity-60"
                >
                  {tt('remove')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SsoInner() {
  const ts = useTranslations('subscriptionPlans.sso')
  const [connections, setConnections] = useState<SsoConnection[]>([])
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/sso')
      if (!res.ok) return
      const data = await res.json()
      setConnections(data.connections || [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function register(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json()
      if (res.ok) {
        setDomain('')
        await load()
      } else {
        setError(data.error || 'Error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await fetch(`/api/sso?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await load()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{ts('title')}</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-4">{ts('description')}</p>

      <form onSubmit={register} className="flex gap-2 mb-4">
        <input
          type="text"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={ts('domain')}
          className={inputClass}
        />
        <button type="submit" disabled={busy} className={buttonClass}>
          {ts('register')}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {connections.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-200">{c.domain}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {c.status === 'active' ? ts('active') : ts('pending')}
                </span>
                <button
                  onClick={() => remove(c.id)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline disabled:opacity-60"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SsoSection() {
  const ts = useTranslations('subscriptionPlans.sso')
  return (
    <FeatureGate feature={FEATURES.SSO} fallback={<section className={cardClass}><h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{ts('title')}</h2><UpgradePrompt message={ts('locked')} /></section>}>
      <SsoInner />
    </FeatureGate>
  )
}

/**
 * Team-seat and SSO management for the subscription page. Both sections are
 * gated by the user's plan (server + database remain authoritative).
 */
export function TeamSsoSettings() {
  return (
    <>
      <TeamSection />
      <SsoSection />
    </>
  )
}

export default TeamSsoSettings
