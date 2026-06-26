'use client'

import { useMemo, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { formatCurrencyAmount } from '@/lib/currency'
import { computeBalance, PAYMENT_KINDS, type PaymentKind } from '@/lib/invoices/payments'
import Button from '@/components/ui/Button'

export interface PaymentRecord {
  id: string
  amount: number
  currency?: string | null
  kind?: string | null
  note?: string | null
  paid_at?: string | null
  created_at?: string | null
}

export interface PaymentRecordedResult {
  fullyPaid: boolean
  status: string
  balance: number
}

export interface PaymentTrackerProps {
  invoiceId: string
  total: number
  currency: string
  /** Current invoice status — used to detect an auto-paid transition for the toast. */
  status: string
  /** All recorded payments for the invoice (read by the page under RLS). */
  payments: PaymentRecord[]
  /** Called after a successful record so the page can refetch payments/history/status. */
  onRecorded?: (result: PaymentRecordedResult) => void
}

const KIND_LABEL_KEY: Record<PaymentKind, string> = {
  payment: 'kindPayment',
  credit: 'kindCredit',
  adjustment: 'kindAdjustment',
}

/**
 * Partial-payment tracker for the invoice detail page. Shows the invoice total,
 * amount paid and the running balance (in an ARIA live region so updates are
 * announced), and lets the owner record a payment/credit/adjustment via the
 * authenticated `/api/invoices/payments` route. The route auto-marks the invoice
 * `paid` once it is settled; this surfaces that transition and asks the page to
 * refetch. The recording call is wrapped in a Sentry span.
 */
export default function PaymentTracker({
  invoiceId,
  total,
  currency,
  status,
  payments,
  onRecorded,
}: PaymentTrackerProps) {
  const t = useTranslations('invoices.detail.payments')
  const locale = useLocale()

  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<PaymentKind>('payment')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { paid, balance, fullyPaid } = useMemo(
    () => computeBalance(total, payments),
    [total, payments],
  )

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const at = new Date(a.paid_at || a.created_at || 0).getTime()
      const bt = new Date(b.paid_at || b.created_at || 0).getTime()
      return bt - at
    })
  }, [payments])

  const money = (value: number) => formatCurrencyAmount(value, currency, locale)
  const formatDate = (value?: string | null) => {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
    } catch {
      return value
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      toast.error(t('errorAmount'))
      return
    }

    setSubmitting(true)
    try {
      await Sentry.startSpan({ name: 'invoices.payments.record', op: 'ui.action', attributes: { kind } }, async () => {
        const supabase = createClient()
        let token: string | undefined
        if (supabase) {
          const { data } = await supabase.auth.getSession()
          token = data?.session?.access_token
        }
        if (!token) {
          toast.error(t('errorLogin'))
          return
        }

        const response = await fetch('/api/invoices/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ invoiceId, amount: numericAmount, kind, note: note.trim() || undefined }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error((payload && payload.error) || t('errorGeneric'))
        }

        const payload = await response.json()
        const becamePaid = payload.status === 'paid' && status !== 'paid'
        toast.success(becamePaid ? t('autoPaid') : t('success'))
        setAmount('')
        setNote('')
        setKind('payment')
        onRecorded?.({
          fullyPaid: !!payload.fullyPaid,
          status: payload.status,
          balance: Number(payload.balance) || 0,
        })
      })
    } catch (err) {
      Sentry.captureException(err)
      toast.error(err instanceof Error ? err.message : t('errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-label={t('heading')}
      className="rounded-card border border-border bg-surface p-4"
    >
      <h3 className="mb-3 text-sm font-medium text-text-secondary">{t('heading')}</h3>

      <dl className="grid grid-cols-3 gap-3" aria-live="polite">
        <div>
          <dt className="text-xs text-text-secondary">{t('total')}</dt>
          <dd className="text-base font-semibold text-text-primary">{money(total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">{t('paid')}</dt>
          <dd className="text-base font-semibold text-success">{money(paid)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">{t('balance')}</dt>
          <dd className={`text-base font-semibold ${fullyPaid ? 'text-success' : 'text-text-primary'}`}>
            {money(balance)}
          </dd>
        </div>
      </dl>

      {fullyPaid && (
        <p className="mt-2 text-sm font-medium text-success" role="status">
          {t('fullyPaid')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium text-text-primary">{t('recordHeading')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="payment-amount" className="mb-1 block text-xs font-medium text-text-secondary">
              {t('amountLabel')}
            </label>
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t('amountPlaceholder')}
              className="w-32 rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label htmlFor="payment-kind" className="mb-1 block text-xs font-medium text-text-secondary">
              {t('kindLabel')}
            </label>
            <select
              id="payment-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as PaymentKind)}
              className="rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {PAYMENT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(KIND_LABEL_KEY[value])}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="payment-note" className="mb-1 block text-xs font-medium text-text-secondary">
              {t('noteLabel')}
            </label>
            <input
              id="payment-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('notePlaceholder')}
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <Button type="submit" size="sm" loading={submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-text-primary">{t('listHeading')}</p>
        {sortedPayments.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('none')}</p>
        ) : (
          <ul className="space-y-1">
            {sortedPayments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <span className="text-text-primary">
                  {money(Number(payment.amount) || 0)}{' '}
                  <span className="text-text-secondary">
                    · {t(KIND_LABEL_KEY[(payment.kind as PaymentKind) || 'payment'] || 'kindPayment')}
                  </span>
                </span>
                <span className="text-text-secondary">
                  {formatDate(payment.paid_at || payment.created_at)}
                  {payment.note ? ` · ${payment.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
