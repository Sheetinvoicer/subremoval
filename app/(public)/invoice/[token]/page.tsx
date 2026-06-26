'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { formatCurrencyAmount } from '@/lib/currency'
import { isInvoiceStatus } from '@/lib/invoices/payments'
import type { PublicInvoice } from '@/lib/invoices/share'

type ErrorReason = 'not_found' | 'expired' | 'revoked' | 'generic'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; invoice: PublicInvoice }
  | { kind: 'error'; reason: ErrorReason }

const ERROR_REASONS: ErrorReason[] = ['not_found', 'expired', 'revoked']

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale)
}

export default function PublicInvoicePage() {
  const t = useTranslations('invoices')
  const locale = useLocale()
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (!token) return
    let active = true

    async function load() {
      try {
        const res = await fetch(`/api/public/invoice/${encodeURIComponent(token as string)}`, {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok && data?.invoice) {
          setState({ kind: 'ready', invoice: data.invoice as PublicInvoice })
          return
        }
        const reason: ErrorReason = ERROR_REASONS.includes(data?.reason) ? data.reason : 'generic'
        setState({ kind: 'error', reason })
      } catch {
        if (active) setState({ kind: 'error', reason: 'generic' })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [token])

  const money = (amount: number, currency: string) => formatCurrencyAmount(amount, currency, locale)

  if (state.kind === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p role="status" aria-live="polite" className="text-text-secondary">
          {t('public.loading')}
        </p>
      </main>
    )
  }

  if (state.kind === 'error') {
    const titles: Record<ErrorReason, { title: string; hint: string }> = {
      not_found: { title: t('public.notFoundTitle'), hint: t('public.notFoundHint') },
      expired: { title: t('public.expiredTitle'), hint: t('public.expiredHint') },
      revoked: { title: t('public.revokedTitle'), hint: t('public.revokedHint') },
      generic: { title: t('public.errorTitle'), hint: t('public.errorHint') },
    }
    const copy = titles[state.reason]
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-xl shadow p-8"
        >
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{copy.title}</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{copy.hint}</p>
        </div>
      </main>
    )
  }

  const { invoice } = state
  const statusLabel = isInvoiceStatus(invoice.status) ? t(`status.${invoice.status}`) : invoice.status || '—'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 flex justify-center print:bg-white print:py-0">
      <article className="invoice-print-area w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow print:shadow-none p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-400">{t('public.invoiceLabel')}</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {invoice.invoiceNumber || '—'}
            </h1>
          </div>
          <div className="text-end">
            <p className="text-sm text-gray-400">{t('public.statusLabel')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{statusLabel}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{t('public.billedTo')}</p>
            <p className="text-gray-900 dark:text-white">{invoice.clientName || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{t('public.issuedLabel')}</p>
            <p className="text-gray-900 dark:text-white">{formatDate(invoice.createdAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{t('public.dueLabel')}</p>
            <p className="text-gray-900 dark:text-white">{formatDate(invoice.dueDate, locale)}</p>
          </div>
        </section>

        {invoice.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-start font-medium">{t('public.description')}</th>
                  <th className="py-2 text-end font-medium">{t('public.quantity')}</th>
                  <th className="py-2 text-end font-medium">{t('public.price')}</th>
                  <th className="py-2 text-end font-medium">{t('public.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 text-gray-900 dark:text-white">{item.description}</td>
                    <td className="py-2 text-end text-gray-900 dark:text-white">{item.quantity}</td>
                    <td className="py-2 text-end text-gray-900 dark:text-white">
                      {money(item.price, invoice.currency)}
                    </td>
                    <td className="py-2 text-end text-gray-900 dark:text-white">
                      {money(item.total, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-6 ms-auto w-full sm:w-1/2 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>{t('public.subtotal')}</span>
            <span>{money(invoice.subtotal, invoice.currency)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>{t('public.tax')}</span>
              <span>{money(invoice.taxAmount, invoice.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2">
            <span>{t('public.total')}</span>
            <span>{money(invoice.total, invoice.currency)}</span>
          </div>
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-6">
          <p className="text-xs text-gray-400">{t('public.poweredBy')}</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm transition-colors"
          >
            {t('public.print')}
          </button>
        </footer>
      </article>
    </main>
  )
}
