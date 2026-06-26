'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { shareLinkPath, shareLinkState } from '@/lib/invoices/share'
import Button from '@/components/ui/Button'

export interface ShareLinkRecord {
  id: string
  token: string
  expires_at?: string | null
  revoked_at?: string | null
  view_count?: number | null
  last_viewed_at?: string | null
  created_at?: string | null
}

export interface ShareLinkPanelProps {
  invoiceId: string
  /** The current (most recent) share link for the invoice, or null. */
  link: ShareLinkRecord | null
  /** Called after a successful create/revoke so the page can refetch the link. */
  onChanged?: () => void
}

async function getAccessToken(): Promise<string | undefined> {
  const supabase = createClient()
  if (!supabase) return undefined
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}

/**
 * Share-link panel for the invoice detail page. Lets the owner create a
 * time-limited public link (resolved by the service-role public route), copy
 * it, see aggregate view analytics, and revoke it — all via the authenticated
 * `/api/invoices/share` route (Sentry-instrumented). Creating a link revokes
 * any prior one, so a single active link exists at a time.
 */
export default function ShareLinkPanel({ invoiceId, link, onChanged }: ShareLinkPanelProps) {
  const t = useTranslations('invoices.detail.share')
  const locale = useLocale()

  const [origin, setOrigin] = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const state = link ? shareLinkState(link) : null
  const isActive = state === 'active'
  const shareUrl = link && origin ? `${origin}${shareLinkPath(link.token)}` : ''

  const formatDate = (value?: string | null) => {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
    } catch {
      return value
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copied'))
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      await Sentry.startSpan({ name: 'invoices.share.create', op: 'ui.action' }, async () => {
        const token = await getAccessToken()
        if (!token) {
          toast.error(t('errorLogin'))
          return
        }
        const days = Number(expiryDays)
        const expiresInDays = expiryDays.trim() && Number.isFinite(days) && days > 0 ? days : undefined
        const response = await fetch('/api/invoices/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ invoiceId, expiresInDays }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error((payload && payload.error) || t('errorCreate'))
        }
        toast.success(t('createdToast'))
        setExpiryDays('')
        onChanged?.()
      })
    } catch (err) {
      Sentry.captureException(err)
      toast.error(err instanceof Error ? err.message : t('errorCreate'))
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!link || revoking) return
    setRevoking(true)
    try {
      await Sentry.startSpan({ name: 'invoices.share.revoke', op: 'ui.action' }, async () => {
        const token = await getAccessToken()
        if (!token) {
          toast.error(t('errorLogin'))
          return
        }
        const response = await fetch(`/api/invoices/share?id=${encodeURIComponent(link.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error((payload && payload.error) || t('errorRevoke'))
        }
        toast.success(t('revokedToast'))
        onChanged?.()
      })
    } catch (err) {
      Sentry.captureException(err)
      toast.error(err instanceof Error ? err.message : t('errorRevoke'))
    } finally {
      setRevoking(false)
    }
  }

  const statusLabel =
    state === 'active'
      ? t('statusActive')
      : state === 'expired'
        ? t('statusExpired')
        : state === 'revoked'
          ? t('statusRevoked')
          : ''

  return (
    <section aria-label={t('heading')} className="rounded-card border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-text-secondary">{t('heading')}</h3>
      <p className="mb-3 text-xs text-text-secondary">{t('description')}</p>

      <div aria-live="polite">
        {isActive && link ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="share-url" className="text-xs font-medium text-text-secondary">
                {t('linkLabel')}
              </label>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                {statusLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="share-url"
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 min-w-[14rem] rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" size="sm" variant="secondary" onClick={handleCopy}>
                {t('copy')}
              </Button>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-text-secondary">{t('viewsLabel')}</dt>
                <dd className="font-semibold text-text-primary">{Number(link.view_count) || 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">{t('lastViewedLabel')}</dt>
                <dd className="font-semibold text-text-primary">
                  {link.last_viewed_at ? formatDate(link.last_viewed_at) : t('neverViewed')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">{t('expiresLabel')}</dt>
                <dd className="font-semibold text-text-primary">
                  {link.expires_at ? formatDate(link.expires_at) : t('neverExpires')}
                </dd>
              </div>
            </dl>
            <Button type="button" size="sm" variant="secondary" onClick={handleRevoke} loading={revoking}>
              {revoking ? t('revoking') : t('revoke')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {state ? statusLabel : t('none')}
          </p>
        )}

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div>
            <label htmlFor="share-expiry" className="mb-1 block text-xs font-medium text-text-secondary">
              {t('expiryLabel')}
            </label>
            <input
              id="share-expiry"
              type="number"
              min="1"
              inputMode="numeric"
              value={expiryDays}
              onChange={(event) => setExpiryDays(event.target.value)}
              placeholder="30"
              aria-describedby="share-expiry-hint"
              className="w-28 rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <Button type="submit" size="sm" loading={creating}>
            {creating ? t('creating') : isActive ? t('regenerate') : t('create')}
          </Button>
          <p id="share-expiry-hint" className="w-full text-xs text-text-secondary">
            {t('expiryHint')}
          </p>
        </form>
      </div>
    </section>
  )
}
