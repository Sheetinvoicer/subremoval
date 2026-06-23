'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client'
import { DetailPageSkeleton } from '@/components/LoadingSkeleton'
import toast, { Toaster } from 'react-hot-toast';
import CurrencyDisplay from '@/components/CurrencyDisplay';
import {
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  INVOICE_TEMPLATE_STORAGE_KEY,
  type InvoiceTemplateSettings,
  sanitizeAccentColor,
  sanitizeInvoiceTemplateSettings,
} from '@/lib/invoiceTemplate';
import { formatMinutesAsHoursMinutes } from '@/lib/timeTracking';
import { useTranslations } from 'next-intl';

interface Invoice {
  id: string
  invoice_number: string
  total: number
  subtotal?: number
  tax_amount?: number
  tax_rate_percentage?: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  due_date: string
  items?: { description: string; quantity: number; price: number; total?: number }[]
  notes?: string
  created_at: string
  clients?: { name?: string; email?: string } | null
}

interface InvoiceTimeEntry {
  id: string
  description: string
  duration_minutes: number
  entry_date: string
  billable: boolean
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    case 'sent':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    case 'paid':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'overdue':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
  }
}

export default function InvoiceDetailPage() {
  const t = useTranslations('invoices')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [templateSettings, setTemplateSettings] = useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_TEMPLATE_SETTINGS)
  const [timeEntries, setTimeEntries] = useState<InvoiceTimeEntry[]>([])
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  useEffect(() => {
    async function loadInvoice() {
      const supabase = createClient()

      if (!supabase) {
        setError(t('detail.failedConnect'))
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setError(t('detail.loginRequired'))
        setLoading(false)
        return
      }

      const { data, error: queryError } = await supabase
        .from('invoices')
        .select('*, clients(name,email)')
        .eq('user_id', user.id)
        .eq('id', id)
        .single()

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }

      setInvoice(data)

      const { data: timeData } = await supabase
        .from('time_entries')
        .select('id,description,duration_minutes,entry_date,billable')
        .eq('user_id', user.id)
        .eq('invoice_id', id)
        .order('entry_date', { ascending: false })

      setTimeEntries((timeData || []) as InvoiceTimeEntry[])

      const { data: currencySettings } = await supabase
        .from('user_currency_settings')
        .select('default_currency')
        .eq('user_id', user.id)
        .single()

      setDisplayCurrency(currencySettings?.default_currency || 'USD')
      setLoading(false)
    }

    if (id) {
      loadInvoice()
    }
  }, [id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(INVOICE_TEMPLATE_STORAGE_KEY)
    if (!raw) return
    try {
      setTemplateSettings(sanitizeInvoiceTemplateSettings(JSON.parse(raw)))
    } catch {
      setTemplateSettings(DEFAULT_INVOICE_TEMPLATE_SETTINGS)
    }
  }, [])

  const computedSubtotal = useMemo(() => {
    if (!invoice?.items?.length) return Number(invoice?.subtotal || 0)
    return invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0)
  }, [invoice])

  const totalTrackedMinutes = useMemo(
    () => timeEntries.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0),
    [timeEntries],
  )

  const updateStatus = async (status: Invoice['status']) => {
    if (!invoice) return
    const supabase = createClient()
    if (!supabase) {
      toast.error(t('detail.supabaseInit'))
      return
    }

    setUpdatingStatus(true)
    const { error: statusError } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoice.id)

    setUpdatingStatus(false)

    if (statusError) {
      toast.error(statusError.message)
      return
    }

    setInvoice({ ...invoice, status })
    toast.success(t('detail.statusUpdated', { status: t(`status.${status}`) }))
  }

  const handleSendInvoice = async () => {
    if (!invoice) return;

    try {
      setSending(true);
      const response = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      if (!response.ok) {
        throw new Error(t('detail.failedSend'));
      }

      toast.success(t('detail.sendSuccess'));
      
      await updateStatus('sent')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('detail.failedSend')
      toast.error(errorMessage)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <DetailPageSkeleton />
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t('detail.errorPrefix')} {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('detail.goBack')}
          </button>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-600 dark:text-yellow-400">{t('detail.invoiceNotFound')}</p>
          <Link
            href="/dashboard/invoices"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            {t('detail.backToInvoices')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Toaster position="top-right" />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('detail.invoiceNumber', { number: invoice.invoice_number })}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('detail.createdLabel')} {new Date(invoice.created_at).toLocaleDateString()}
            </p>
          </div>
          {templateSettings.fields.showStatusBadge && (
            <span
              className="px-3 py-1 rounded-full text-xs text-white"
              style={{ backgroundColor: sanitizeAccentColor(templateSettings.accentColor) }}
            >
              {templateSettings.template.toUpperCase()} {t('detail.templateSuffix')}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <>
                <button
                  onClick={handleSendInvoice}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {sending ? t('detail.sending') : t('detail.sendInvoice')}
                </button>
                <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">{t('detail.edit')}</Link>
              </>
            )}
            {['draft', 'sent', 'paid', 'overdue'].map((statusOption) => (
              <button
                key={statusOption}
                onClick={() => updateStatus(statusOption as Invoice['status'])}
                disabled={updatingStatus || invoice.status === statusOption}
                className="px-3 py-2 border rounded-lg text-xs disabled:opacity-50"
              >
                {t(`status.${statusOption}`)}
              </button>
            ))}
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('detail.back')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {templateSettings.fields.showClientDetails && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.client')}</h3>
              <p className="text-gray-900 dark:text-white">{invoice.clients?.name || '-'}</p>
              <p className="text-gray-600 dark:text-gray-300">{invoice.clients?.email || '-'}</p>
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.amount')}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              <CurrencyDisplay amount={invoice.total} sourceCurrency={invoice.currency} displayCurrency={displayCurrency} />
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.status')}</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
              {t(`status.${invoice.status}`)}
            </span>
          </div>
          {templateSettings.fields.showDueDate && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.dueDate')}</h3>
              <p className="text-gray-900 dark:text-white">
                {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {invoice.items && invoice.items.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('detail.items')}</h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.description')}</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.quantity')}</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.price')}</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx: number) => (
                    <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{item.description}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{item.quantity}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                        <CurrencyDisplay amount={item.price} sourceCurrency={invoice.currency} displayCurrency={displayCurrency} />
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                        <CurrencyDisplay amount={item.quantity * item.price} sourceCurrency={invoice.currency} displayCurrency={displayCurrency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {(invoice.tax_rate_percentage || 0) > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                        {t('detail.tax', { rate: invoice.tax_rate_percentage })}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                        <CurrencyDisplay amount={invoice.tax_amount || 0} sourceCurrency={invoice.currency} displayCurrency={displayCurrency} />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">
                        {t('detail.total')}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">
                        <CurrencyDisplay
                          amount={invoice.total || computedSubtotal + (invoice.tax_amount || 0)}
                          sourceCurrency={invoice.currency}
                          displayCurrency={displayCurrency}
                        />
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.linkedTimeEntries')}</h3>
            <Link href="/dashboard/time" className="text-sm text-blue-600 hover:underline">{t('detail.manageTimeEntries')}</Link>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-3">{t('detail.totalTracked')} <span className="font-semibold text-gray-900 dark:text-white">{formatMinutesAsHoursMinutes(totalTrackedMinutes)}</span></p>
            {timeEntries.length === 0 ? (
              <p className="text-sm text-gray-500">{t('detail.noTimeEntries')}</p>
            ) : (
              <div className="space-y-2">
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="flex justify-between text-sm border-t first:border-t-0 pt-2 first:pt-0 border-gray-200 dark:border-gray-700">
                    <span>{entry.description}</span>
                    <span className="font-medium">{formatMinutesAsHoursMinutes(entry.duration_minutes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {invoice.notes && templateSettings.fields.showNotes && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('detail.notes')}</h3>
            <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}