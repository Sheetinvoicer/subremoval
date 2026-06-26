'use client'

import { useMemo, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { InvoiceListRow } from '@/hooks/useInvoicesQuery'
import { serializeInvoiceParams, type InvoiceQueryParams } from '@/lib/invoices/query'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { CheckCircle2, Send, Trash2, Percent, XCircle, Download } from 'lucide-react'

export type BulkAction = 'markPaid' | 'send' | 'delete' | 'applyTax'

export interface BulkItemResult {
  invoiceId: string
  invoiceNumber: string
  success: boolean
  error?: string
}

export interface BulkActionBarProps {
  /** Ids of the invoices the user has selected (managed by the list page). */
  selectedIds: string[]
  /** The currently rendered page of rows — used to label per-item results. */
  invoices: InvoiceListRow[]
  /** Replace the current selection (e.g. clear it after a destructive run). */
  onChangeSelection: (ids: string[]) => void
  /** Called after every bulk run so the page can refetch the list. */
  onDone: () => void
  /** Active list filters — exports target this filtered set, not the selection. */
  params?: InvoiceQueryParams
  /** Active UI locale for localized CSV/PDF exports. */
  locale?: string
}

/**
 * Rounds a monetary value to 2 decimals. Mirrors the create-invoice page's
 * tax/total math (`tax = subtotal * rate / 100`, `total = subtotal + tax`) but
 * stores clean 2-decimal money values.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Accessible bulk-action toolbar for the enterprise invoice list. Performs
 * mark-paid / send / delete / apply-tax across the selected invoices, reporting
 * per-item success/failure and refetching the list on completion. Mutations run
 * under RLS via the browser Supabase client (except send, which reuses the
 * existing `/api/send-invoice` endpoint); every run is wrapped in a Sentry span.
 */
export default function BulkActionBar({
  selectedIds,
  invoices,
  onChangeSelection,
  onDone,
  params = {},
  locale = 'en',
}: BulkActionBarProps) {
  const t = useTranslations('invoices.list.bulk')
  const tExport = useTranslations('invoices.list.export')

  const [runningAction, setRunningAction] = useState<BulkAction | null>(null)
  const [progress, setProgress] = useState({ total: 0, completed: 0, succeeded: 0, failed: 0 })
  const [results, setResults] = useState<BulkItemResult[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showTaxInput, setShowTaxInput] = useState(false)
  const [taxRate, setTaxRate] = useState('')
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const selectedCount = selectedIds.length
  const busy = runningAction !== null
  const disabled = selectedCount === 0 || busy

  const numberById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const invoice of invoices) map[invoice.id] = invoice.invoice_number
    return map
  }, [invoices])

  const numberFor = (id: string) => numberById[id] || id

  /** Runs `perItem` for every selected id, tracking per-item results + progress. */
  async function executeBulk(action: BulkAction, perItem: (id: string) => Promise<void>): Promise<number> {
    if (disabled) return 0
    const ids = [...selectedIds]
    setRunningAction(action)
    setResults([])
    setProgress({ total: ids.length, completed: 0, succeeded: 0, failed: 0 })

    let failed = 0
    await Sentry.startSpan({ name: `invoices.bulk.${action}`, op: 'ui.action' }, async () => {
      for (const id of ids) {
        try {
          await perItem(id)
          setResults((prev) => [...prev, { invoiceId: id, invoiceNumber: numberFor(id), success: true }])
          setProgress((prev) => ({ ...prev, completed: prev.completed + 1, succeeded: prev.succeeded + 1 }))
        } catch (err) {
          failed += 1
          Sentry.captureException(err)
          const message = err instanceof Error ? err.message : t('errorGeneric')
          setResults((prev) => [
            ...prev,
            { invoiceId: id, invoiceNumber: numberFor(id), success: false, error: message },
          ])
          setProgress((prev) => ({ ...prev, completed: prev.completed + 1, failed: prev.failed + 1 }))
        }
      }
    })

    setRunningAction(null)
    if (failed === 0) toast.success(t('toastSuccess', { count: ids.length }))
    else toast.error(t('toastPartial', { failed, total: ids.length }))
    onDone()
    return failed
  }

  /** Creates the browser client + resolves the current user, then runs `run`. */
  async function withAuthedClient(
    run: (supabase: SupabaseClient, userId: string) => Promise<void>,
  ) {
    const supabase = createClient()
    if (!supabase) {
      toast.error(t('errorSupabaseInit'))
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (!userId) {
      toast.error(t('errorLoginRequired'))
      return
    }
    await run(supabase, userId)
  }

  function handleSend() {
    if (disabled) return
    void executeBulk('send', async (id) => {
      const response = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: id }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error((payload && payload.error) || t('errorSendFailed'))
      }
    })
  }

  function handleMarkPaid() {
    if (disabled) return
    void withAuthedClient(async (supabase, userId) => {
      await executeBulk('markPaid', async (id) => {
        const { error } = await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', id)
          .eq('user_id', userId)
        if (error) throw new Error(error.message)
      })
    })
  }

  function handleDeleteConfirmed() {
    setConfirmingDelete(false)
    void withAuthedClient(async (supabase, userId) => {
      const failed = await executeBulk('delete', async (id) => {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        if (error) throw new Error(error.message)
      })
      // Deleted rows are gone — drop the (now stale) selection.
      if (failed === 0) onChangeSelection([])
    })
  }

  function handleApplyTax() {
    if (disabled) return
    const rate = Number(taxRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error(t('errorTaxRate'))
      return
    }
    void withAuthedClient(async (supabase, userId) => {
      const ids = [...selectedIds]
      // Tax/total are recomputed from the persisted subtotal, which the list
      // columns omit — fetch it (under RLS) for the selected rows first.
      const { data: rows, error: fetchError } = await supabase
        .from('invoices')
        .select('id, subtotal')
        .in('id', ids)
        .eq('user_id', userId)
      if (fetchError) {
        Sentry.captureException(fetchError)
        toast.error(fetchError.message)
        return
      }
      const subtotalById: Record<string, number> = {}
      for (const row of (rows as { id: string; subtotal: number | null }[] | null) || []) {
        subtotalById[row.id] = Number(row.subtotal) || 0
      }
      await executeBulk('applyTax', async (id) => {
        if (!(id in subtotalById)) throw new Error(t('errorSubtotalMissing'))
        const subtotal = subtotalById[id]
        const taxAmount = round2((subtotal * rate) / 100)
        const total = round2(subtotal + taxAmount)
        const { error } = await supabase
          .from('invoices')
          .update({ tax_rate_percentage: rate, tax_amount: taxAmount, total })
          .eq('id', id)
          .eq('user_id', userId)
        if (error) throw new Error(error.message)
      })
      setShowTaxInput(false)
      setTaxRate('')
    })
  }

  // Exports the active filtered set (not the selection) as CSV or PDF via the
  // authenticated /api/invoices/export route, then triggers a browser download.
  async function handleExport(format: 'csv' | 'pdf') {
    if (exporting) return
    setExporting(format)
    try {
      await Sentry.startSpan({ name: `invoices.export.${format}`, op: 'ui.action' }, async () => {
        const supabase = createClient()
        let token: string | undefined
        if (supabase) {
          const { data } = await supabase.auth.getSession()
          token = data?.session?.access_token
        }

        const response = await fetch('/api/invoices/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            params: Object.fromEntries(serializeInvoiceParams(params)),
            format,
            locale,
            title: tExport('title'),
            labels: {
              invoiceNumber: tExport('columns.invoiceNumber'),
              client: tExport('columns.client'),
              project: tExport('columns.project'),
              status: tExport('columns.status'),
              subtotal: tExport('columns.subtotal'),
              tax: tExport('columns.tax'),
              total: tExport('columns.total'),
              currency: tExport('columns.currency'),
              dueDate: tExport('columns.dueDate'),
              createdAt: tExport('columns.createdAt'),
              generatedAt: tExport('meta.generatedAt'),
              filters: tExport('meta.filters'),
              locale: tExport('meta.locale'),
            },
          }),
        })

        if (response.status === 413) {
          const payload = await response.json().catch(() => ({}))
          toast.error(tExport('tooMany', { max: payload?.max ?? '' }))
          return
        }
        if (!response.ok) throw new Error(`Export failed (${response.status})`)

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `invoices-${new Date().toISOString().slice(0, 10)}.${format}`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        toast.success(tExport('success'))
      })
    } catch (err) {
      Sentry.captureException(err)
      toast.error(tExport('failed'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card hoverGlow={false} className="mb-4" role="region" aria-label={t('regionLabel')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-text-primary" aria-live="polite">
          {selectedCount > 0 ? t('selected', { count: selectedCount }) : t('noSelection')}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkPaid}
            disabled={disabled}
            loading={runningAction === 'markPaid'}
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            {t('markPaid')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSend}
            disabled={disabled}
            loading={runningAction === 'send'}
          >
            <Send size={15} aria-hidden="true" />
            {t('send')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowTaxInput((value) => !value)
              setConfirmingDelete(false)
            }}
            disabled={disabled}
            aria-expanded={showTaxInput}
          >
            <Percent size={15} aria-hidden="true" />
            {t('applyTax')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setConfirmingDelete(true)
              setShowTaxInput(false)
            }}
            disabled={disabled}
            loading={runningAction === 'delete'}
          >
            <Trash2 size={15} aria-hidden="true" />
            {t('delete')}
          </Button>
          {selectedCount > 0 && !busy && (
            <button
              type="button"
              onClick={() => onChangeSelection([])}
              className="rounded-button px-2 py-1 text-sm text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {t('clear')}
            </button>
          )}
        </div>

        {/* Export the active filtered list (independent of the selection). */}
        <div className="flex flex-wrap items-center gap-2 ms-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            loading={exporting === 'csv'}
          >
            <Download size={15} aria-hidden="true" />
            {tExport('csv')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            loading={exporting === 'pdf'}
          >
            <Download size={15} aria-hidden="true" />
            {tExport('pdf')}
          </Button>
        </div>
      </div>

      {/* Apply-tax-rate input */}
      {showTaxInput && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="bulk-tax-rate" className="mb-1 block text-sm font-medium text-text-secondary">
              {t('taxRateLabel')}
            </label>
            <input
              id="bulk-tax-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              placeholder={t('taxRatePlaceholder')}
              className="w-32 rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <Button size="sm" onClick={handleApplyTax} disabled={disabled} loading={runningAction === 'applyTax'}>
            {t('apply')}
          </Button>
          <button
            type="button"
            onClick={() => {
              setShowTaxInput(false)
              setTaxRate('')
            }}
            className="rounded-button px-2 py-2 text-sm text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-label={t('confirmTitle', { count: selectedCount })}
          className="mt-3 rounded-button border border-red-500/30 bg-red-500/10 p-3"
        >
          <p className="text-sm font-medium text-text-primary">{t('confirmTitle', { count: selectedCount })}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('confirmBody')}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={handleDeleteConfirmed} loading={runningAction === 'delete'}>
              {t('confirmDelete')}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-button px-2 py-2 text-sm text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {progress.total > 0 && (
        <p className="mt-3 text-sm text-text-secondary" aria-live="polite">
          {t('progress', { completed: progress.completed, total: progress.total })}
        </p>
      )}

      {/* Per-item results */}
      {results.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium text-text-primary">{t('resultsTitle')}</p>
          <ul className="mt-1 space-y-1">
            {results.map((result) => (
              <li
                key={result.invoiceId}
                className={`flex items-center gap-1.5 text-xs ${result.success ? 'text-success' : 'text-red-400'}`}
              >
                {result.success ? (
                  <CheckCircle2 size={13} aria-hidden="true" />
                ) : (
                  <XCircle size={13} aria-hidden="true" />
                )}
                <span>
                  {result.invoiceNumber}:{' '}
                  {result.success
                    ? t('resultSuccess')
                    : `${t('resultFailed')}${result.error ? ` — ${result.error}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
