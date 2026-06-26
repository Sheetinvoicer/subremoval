'use client'

import { useTranslations } from 'next-intl'
import { Check, Circle, AlertTriangle } from 'lucide-react'
import {
  INVOICE_STATUS_FLOW,
  INVOICE_STATUS_BRANCHES,
  type InvoiceStatus,
} from '@/lib/invoices/payments'

export interface StatusTimelineProps {
  /** The invoice's current status (any of the lifecycle states). */
  status: string
}

/**
 * Accessible status timeline for the invoice detail page. Renders the linear
 * "happy path" (draft → sent → viewed → paid) as an ordered list, marking the
 * steps reached and the current one (`aria-current="step"`). Terminal/branch
 * states (overdue / disputed / cancelled) are surfaced as a highlighted flag.
 *
 * Labels reuse the localized `invoices.status.*` keys so the timeline stays in
 * sync with the rest of the UI.
 */
export default function StatusTimeline({ status }: StatusTimelineProps) {
  const t = useTranslations('invoices.detail.timeline')
  const tStatus = useTranslations('invoices.status')

  const flowIndex = INVOICE_STATUS_FLOW.indexOf(status as InvoiceStatus)
  const isBranch = (INVOICE_STATUS_BRANCHES as readonly string[]).includes(status)
  // overdue/disputed imply the invoice was at least sent; cancelled may happen
  // at any time, so only the first (draft) step is marked reached for it.
  const reachedIndex = flowIndex >= 0 ? flowIndex : status === 'cancelled' ? 0 : 1

  return (
    <section aria-label={t('heading')} className="rounded-card border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">{t('heading')}</h3>
      <ol className="flex flex-wrap items-center gap-2">
        {INVOICE_STATUS_FLOW.map((step, index) => {
          const complete = index <= reachedIndex
          const current = flowIndex === index
          return (
            <li
              key={step}
              aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                current
                  ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                  : complete
                    ? 'bg-success/10 text-success'
                    : 'bg-background text-text-secondary'
              }`}
            >
              {complete ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Circle size={13} aria-hidden="true" />
              )}
              <span>{tStatus(step)}</span>
            </li>
          )
        })}
      </ol>

      {isBranch && (
        <p
          aria-current="step"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 ring-1 ring-red-500/30"
        >
          <AlertTriangle size={13} aria-hidden="true" />
          <span>{tStatus(status)}</span>
        </p>
      )}
    </section>
  )
}
