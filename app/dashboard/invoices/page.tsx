'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

type BulkResult = {
  invoiceId: string
  success: boolean
  error?: string
}

interface Invoice {
  id: string
  invoice_number: string
  total: number
  currency: string
  status: string
  due_date: string
  created_at: string
  clients?: { name?: string } | null
  projects?: { name?: string } | null
}

export default function InvoicesPage() {
  const t = useTranslations('invoices');
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_desc')
  const [page, setPage] = useState(1)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResults, setBulkResults] = useState<Record<string, BulkResult>>({})
  const [bulkProgress, setBulkProgress] = useState({ total: 0, completed: 0, sent: 0, failed: 0 })
  const pageSize = 9

  useEffect(() => {
    loadInvoices()
  }, [statusFilter, sortBy])

  async function loadInvoices() {
    try {
      const supabase = createClient()
      if (!supabase) {
        setError(t('errors.supabaseInit'))
        setLoading(false)
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        setError(t('errors.loginRequired'))
        setLoading(false)
        return
      }

      let query = supabase
        .from('invoices')
        .select('id, invoice_number, total, currency, status, due_date, created_at, clients(name), projects(name)')
        .eq('user_id', user.id)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (sortBy === 'created_asc') query = query.order('created_at', { ascending: true })
      if (sortBy === 'created_desc') query = query.order('created_at', { ascending: false })
      if (sortBy === 'due_asc') query = query.order('due_date', { ascending: true })
      if (sortBy === 'due_desc') query = query.order('due_date', { ascending: false })
      if (sortBy === 'total_desc') query = query.order('total', { ascending: false })
      if (sortBy === 'total_asc') query = query.order('total', { ascending: true })

      const { data, error: queryError } = await query

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }

      setInvoices((data as unknown as Invoice[]) || [])
      setPage(1)
      setSelectedInvoiceIds([])
      setBulkResults({})
      setBulkProgress({ total: 0, completed: 0, sent: 0, failed: 0 })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedLoadData')
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(invoices.length / pageSize))
  const pagedInvoices = useMemo(() => invoices.slice((page - 1) * pageSize, page * pageSize), [invoices, page])
  const selectedInvoicesCount = selectedInvoiceIds.length
  const allPagedSelected = pagedInvoices.length > 0 && pagedInvoices.every((invoice) => selectedInvoiceIds.includes(invoice.id))

  async function handleBulkSend() {
    if (selectedInvoiceIds.length === 0 || bulkSending) return

    setBulkSending(true)
    setBulkResults({})
    setBulkProgress({ total: selectedInvoiceIds.length, completed: 0, sent: 0, failed: 0 })

    for (const invoiceId of selectedInvoiceIds) {
      try {
        const response = await fetch('/api/send-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          const error = payload?.error || t('errors.failedSendInvoice')
          setBulkResults((prev) => ({ ...prev, [invoiceId]: { invoiceId, success: false, error } }))
          setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1, failed: prev.failed + 1 }))
          continue
        }

        setBulkResults((prev) => ({ ...prev, [invoiceId]: { invoiceId, success: true } }))
        setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1, sent: prev.sent + 1 }))
        setInvoices((prev) => prev.map((invoice) => (invoice.id === invoiceId ? { ...invoice, status: invoice.status === 'paid' ? 'paid' : 'sent' } : invoice)))
      } catch (error) {
        const message = error instanceof Error ? error.message : t('errors.failedSendInvoice')
        setBulkResults((prev) => ({ ...prev, [invoiceId]: { invoiceId, success: false, error: message } }))
        setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1, failed: prev.failed + 1 }))
      }
    }

    setBulkSending(false)
  }

  function toggleInvoiceSelection(invoiceId: string) {
    setSelectedInvoiceIds((prev) => (prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId]))
  }

  function togglePageSelection() {
    const pageIds = pagedInvoices.map((invoice) => invoice.id)
    setSelectedInvoiceIds((prev) => {
      if (allPagedSelected) {
        return prev.filter((id) => !pageIds.includes(id))
      }

      return Array.from(new Set([...prev, ...pageIds]))
    })
  }

  const getStatusColor = (status: string) => {
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
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t('errorLabel')}: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('actions.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/invoices/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
          + {t('actions.newInvoice')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-2">
          <option value="all">{t('filters.allStatuses')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="sent">{t('status.sent')}</option>
          <option value="paid">{t('status.paid')}</option>
          <option value="overdue">{t('status.overdue')}</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border rounded px-3 py-2">
          <option value="created_desc">{t('sort.newest')}</option>
          <option value="created_asc">{t('sort.oldest')}</option>
          <option value="due_asc">{t('sort.dueAsc')}</option>
          <option value="due_desc">{t('sort.dueDesc')}</option>
          <option value="total_desc">{t('sort.amountHighLow')}</option>
          <option value="total_asc">{t('sort.amountLowHigh')}</option>
        </select>
        {invoices.length > 0 && (
          <button
            onClick={togglePageSelection}
            className="border rounded px-3 py-2 text-sm"
          >
            {allPagedSelected ? t('actions.unselectPage') : t('actions.selectPage')}
          </button>
        )}
        <button
          onClick={handleBulkSend}
          disabled={selectedInvoicesCount === 0 || bulkSending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {bulkSending ? `Sending ${bulkProgress.completed}/${bulkProgress.total}...` : `Send selected (${selectedInvoicesCount})`}
        </button>
      </div>

      {bulkProgress.total > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Progress: {bulkProgress.completed}/{bulkProgress.total} • Sent: {bulkProgress.sent} • Failed: {bulkProgress.failed}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-300">Selected invoices: {selectedInvoicesCount}</span>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No invoices yet</p>
          <Link href="/dashboard/invoices/new" className="text-blue-600 hover:underline">Create your first invoice</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedInvoices.map((invoice, idx) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="mb-3 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedInvoiceIds.includes(invoice.id)}
                    onChange={() => toggleInvoiceSelection(invoice.id)}
                  />
                  Select
                </label>
                {bulkResults[invoice.id] && (
                  <span className={`text-xs ${bulkResults[invoice.id].success ? 'text-green-600' : 'text-red-600'}`}>
                    {bulkResults[invoice.id].success ? 'Sent' : `Failed: ${bulkResults[invoice.id].error}`}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {invoice.invoice_number}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                    {invoice.clients?.name || 'Unknown Client'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Project: {invoice.projects?.name || 'Unassigned'}
                  </p>
                </div>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {invoice.currency} {(invoice.total || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Due: {new Date(invoice.due_date).toLocaleDateString()}
                  </p>
                </div>
                <Link href={`/dashboard/invoices/${invoice.id}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm">View →</Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {invoices.length > pageSize && (
        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  )
}