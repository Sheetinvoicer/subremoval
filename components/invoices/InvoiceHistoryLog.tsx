'use client'

import { useLocale, useTranslations } from 'next-intl'
import { History } from 'lucide-react'

export interface InvoiceHistoryEntry {
  id: string
  action: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  created_at?: string | null
}

export interface InvoiceHistoryLogProps {
  entries: InvoiceHistoryEntry[]
}

// Maps a stored `action` string to its localized label key. Dotted action
// identifiers (e.g. `payment.recorded`) map to flat camelCase i18n keys so they
// don't collide with next-intl's nested path lookup.
const ACTION_LABEL_KEY: Record<string, string> = {
  'payment.recorded': 'paymentRecorded',
  'invoice.paid': 'invoicePaid',
  'status.changed': 'statusChanged',
}

/**
 * Owner-visible change log for the invoice detail page. Renders `invoice_history`
 * entries newest-first with a localized action label and timestamp, plus a small
 * detail line summarizing the change when one is available.
 */
export default function InvoiceHistoryLog({ entries }: InvoiceHistoryLogProps) {
  const t = useTranslations('invoices.detail.history')
  const locale = useLocale()

  const sorted = [...entries].sort((a, b) => {
    const at = new Date(a.created_at || 0).getTime()
    const bt = new Date(b.created_at || 0).getTime()
    return bt - at
  })

  const label = (action: string) => t(`actions.${ACTION_LABEL_KEY[action] || 'unknown'}`)

  const formatDate = (value?: string | null) => {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    } catch {
      return value
    }
  }

  const detailFor = (entry: InvoiceHistoryEntry): string | null => {
    const after = entry.after || {}
    if (entry.action === 'status.changed' || entry.action === 'invoice.paid') {
      const next = after.status
      if (typeof next === 'string') return String(next)
    }
    return null
  }

  return (
    <section aria-label={t('heading')} className="rounded-card border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
        <History size={15} aria-hidden="true" />
        {t('heading')}
      </h3>

      {sorted.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('empty')}</p>
      ) : (
        <ol className="space-y-2">
          {sorted.map((entry) => {
            const detail = detailFor(entry)
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 border-s-2 border-accent/40 ps-3 text-sm"
              >
                <span className="text-text-primary">
                  {label(entry.action)}
                  {detail ? <span className="text-text-secondary"> · {detail}</span> : null}
                </span>
                <time className="text-xs text-text-secondary" dateTime={entry.created_at || undefined}>
                  {formatDate(entry.created_at)}
                </time>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
