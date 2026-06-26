'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import { Sparkles, Plus } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import UpgradePrompt from '@/components/UpgradePrompt'
import { formatCurrencyAmount } from '@/lib/currency'

export interface AIGeneratedItem {
  description: string
  quantity: number
  price: number
}

export interface AIGeneratedResult {
  items: AIGeneratedItem[]
  notes: string
}

interface AILineItemAssistantProps {
  currency: string
  locale: string
  /** Appends the generated items (and, when `notes` is non-empty, the notes). */
  onApply: (result: AIGeneratedResult) => void
}

type ErrorKind = 'locked' | 'login' | 'unavailable' | 'generic'

const inputClass =
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'

/**
 * In-editor AI assistant: turns a short natural-language brief into structured
 * line items (+ an optional notes summary) via the gated
 * `POST /api/invoices/ai-generate` route. Results are previewed and only merged
 * into the form when the user clicks "Add", so manual entry is never lost. The
 * Pro-plan requirement is enforced server-side; a 403 surfaces an upgrade
 * prompt here.
 */
export default function AILineItemAssistant({ currency, locale, onApply }: AILineItemAssistantProps) {
  const t = useTranslations('invoices.editor.ai')
  const [brief, setBrief] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [result, setResult] = useState<AIGeneratedResult | null>(null)
  const [includeNotes, setIncludeNotes] = useState(true)
  const briefId = useId()

  const reset = () => {
    setError(null)
    setErrorKind(null)
  }

  const generate = async () => {
    reset()
    setResult(null)
    const value = brief.trim()
    if (!value) {
      setError(t('errors.briefRequired'))
      setErrorKind('generic')
      return
    }

    setLoading(true)
    try {
      await Sentry.startSpan({ name: 'invoices.ai.generate.client', op: 'http.client' }, async () => {
        const res = await fetch('/api/invoices/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief: value, currency, locale }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (res.status === 403) {
            setErrorKind('locked')
            setError(t('errors.locked'))
          } else if (res.status === 401) {
            setErrorKind('login')
            setError(t('errors.login'))
          } else if (res.status === 503) {
            setErrorKind('unavailable')
            setError(t('errors.unavailable'))
          } else {
            setErrorKind('generic')
            setError(typeof data?.error === 'string' && data.error ? data.error : t('errors.generic'))
          }
          return
        }

        const data = await res.json()
        setResult({
          items: Array.isArray(data.items) ? data.items : [],
          notes: typeof data.notes === 'string' ? data.notes : '',
        })
      })
    } catch (err) {
      Sentry.captureException(err)
      setErrorKind('generic')
      setError(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const apply = () => {
    if (!result) return
    onApply({ items: result.items, notes: includeNotes ? result.notes : '' })
    setResult(null)
    setBrief('')
  }

  return (
    <Card hoverGlow={false}>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-button bg-accent/10 p-1.5 text-accent">
          <Sparkles size={16} />
        </span>
        <h2 className="font-semibold text-text-primary">{t('heading')}</h2>
      </div>
      <p className="mb-3 text-xs text-text-secondary">{t('description')}</p>

      <label htmlFor={briefId} className="block text-sm font-medium mb-1 text-text-secondary">
        {t('briefLabel')}
      </label>
      <textarea
        id={briefId}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder={t('briefPlaceholder')}
        className={`${inputClass} min-h-20`}
        disabled={loading}
      />

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" onClick={generate} loading={loading} disabled={loading || !brief.trim()}>
          <Sparkles size={16} aria-hidden="true" />
          {t('generate')}
        </Button>
        <span className="text-xs text-text-secondary" aria-live="polite">
          {loading ? t('generating') : ''}
        </span>
      </div>

      {error && errorKind === 'locked' && (
        <div className="mt-4">
          <UpgradePrompt message={t('errors.locked')} />
        </div>
      )}
      {error && errorKind !== 'locked' && (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-card border border-border bg-surface p-3" data-testid="ai-result">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t('resultHeading', { count: result.items.length })}
          </p>
          <ul className="space-y-1">
            {result.items.map((item, index) => (
              <li key={`${item.description}-${index}`} className="flex justify-between gap-3 text-sm text-text-primary">
                <span className="truncate">{item.description}</span>
                <span className="shrink-0 text-text-secondary">
                  {item.quantity} × {formatCurrencyAmount(item.price, currency, locale)}
                </span>
              </li>
            ))}
          </ul>

          {result.notes && (
            <div className="mt-3 border-t border-border pt-3">
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
                />
                <span>
                  <span className="font-medium">{t('notesLabel')}</span>
                  <span className="block text-text-secondary">{result.notes}</span>
                </span>
              </label>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={apply}>
              <Plus size={14} aria-hidden="true" />
              {t('apply')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setResult(null)}>
              {t('dismiss')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
