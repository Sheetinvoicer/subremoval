'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Download,
  Inbox,
  AlertTriangle,
} from 'lucide-react';

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
  const [statusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_desc')
  const [activeFilter, setActiveFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResults, setBulkResults] = useState<Record<string, BulkResult>>({})
  const [bulkProgress, setBulkProgress] = useState({ total: 0, completed: 0, sent: 0, failed: 0 })
  const [exportingId, setExportingId] = useState<string | null>(null)
  const pageSize = 9
  // Debounce the search box so filtering large lists does not re-run on every keystroke.
  const debouncedSearch = useDebounce(searchQuery, 300)

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

  const isOverdue = (invoice: Invoice) =>
    invoice.status !== 'paid' && invoice.due_date && new Date(invoice.due_date) < new Date()

  const filteredInvoices = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return invoices.filter((invoice) => {
      // Status filter buttons.
      if (activeFilter === 'paid' && invoice.status !== 'paid') return false
      if (activeFilter === 'pending' && (invoice.status === 'paid' || isOverdue(invoice))) return false
      if (activeFilter === 'overdue' && !(invoice.status === 'overdue' || isOverdue(invoice))) return false

      // Search by invoice number and client name.
      if (q) {
        const number = (invoice.invoice_number || '').toLowerCase()
        const clientName = (invoice.clients?.name || '').toLowerCase()
        if (!number.includes(q) && !clientName.includes(q)) return false
      }
      return true
    })
  }, [invoices, activeFilter, debouncedSearch])

  useEffect(() => {
    setPage(1)
  }, [activeFilter, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize))
  const pagedInvoices = useMemo(
    () => filteredInvoices.slice((page - 1) * pageSize, page * pageSize),
    [filteredInvoices, page]
  )
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

  async function exportInvoicePdf(invoice: Invoice) {
    const node = document.getElementById(`invoice-card-${invoice.id}`)
    if (!node) return
    try {
      setExportingId(invoice.id)
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(node).backgroundColor || '#0A0A0A',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${invoice.invoice_number || 'invoice'}.pdf`)
      toast.success(t('actions.exported'))
    } catch (err) {
      console.error(err)
      toast.error(t('actions.exportFailed'))
    } finally {
      setExportingId(null)
    }
  }

  const statusBadgeVariant = (invoice: Invoice): 'success' | 'accent' | 'default' => {
    if (invoice.status === 'paid') return 'success'
    if (invoice.status === 'overdue' || isOverdue(invoice)) return 'default'
    return 'accent'
  }

  const filterButtons: { key: 'all' | 'paid' | 'pending' | 'overdue'; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    { key: 'paid', label: t('filters.paid') },
    { key: 'pending', label: t('filters.pending') },
    { key: 'overdue', label: t('filters.overdue') },
  ]

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Card hoverGlow={false} className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <AlertTriangle size={44} className="text-red-400" />
          </div>
          <p className="text-text-secondary mb-4">{t('errorLabel')}: {error}</p>
          <Button onClick={() => window.location.reload()}>{t('actions.tryAgain')}</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button>
            <Plus size={16} />
            {t('actions.newInvoice')}
          </Button>
        </Link>
      </div>

      {/* Search + filters */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full rounded-button border border-border bg-surface py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`rounded-button px-4 py-1.5 text-sm font-medium transition-all duration-250 ${
                activeFilter === f.key
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'border border-border bg-surface text-text-secondary hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="created_desc">{t('sort.newest')}</option>
            <option value="created_asc">{t('sort.oldest')}</option>
            <option value="due_asc">{t('sort.dueAsc')}</option>
            <option value="due_desc">{t('sort.dueDesc')}</option>
            <option value="total_desc">{t('sort.amountHighLow')}</option>
            <option value="total_asc">{t('sort.amountLowHigh')}</option>
          </select>
        </div>
      </div>

      {/* Bulk controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {filteredInvoices.length > 0 && (
          <button
            onClick={togglePageSelection}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:text-white"
          >
            {allPagedSelected ? t('actions.unselectPage') : t('actions.selectPage')}
          </button>
        )}
        <Button
          variant="secondary"
          onClick={handleBulkSend}
          disabled={selectedInvoicesCount === 0 || bulkSending}
          loading={bulkSending}
        >
          {bulkSending
            ? t('labels.bulkSending', { completed: bulkProgress.completed, total: bulkProgress.total })
            : t('labels.sendSelected', { count: selectedInvoicesCount })}
        </Button>
        <span className="text-sm text-text-secondary">{t('labels.selectedInvoices', { count: selectedInvoicesCount })}</span>
      </div>

      {bulkProgress.total > 0 && (
        <Card hoverGlow={false} className="mb-4 py-3">
          <p className="text-sm text-text-secondary">
            {t('labels.progress', { completed: bulkProgress.completed, total: bulkProgress.total, sent: bulkProgress.sent, failed: bulkProgress.failed })}
          </p>
        </Card>
      )}

      {/* Empty / no results / grid */}
      {invoices.length === 0 ? (
        <Card hoverGlow={false} className="text-center py-12">
          <div className="flex justify-center mb-4">
            <span className="rounded-full bg-accent/10 p-4 text-accent">
              <Inbox size={36} />
            </span>
          </div>
          <p className="text-text-secondary mb-4">{t('labels.noInvoices')}</p>
          <Link href="/dashboard/invoices/new">
            <Button>
              <Plus size={16} />
              {t('actions.newInvoice')}
            </Button>
          </Link>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card hoverGlow={false} className="text-center py-12">
          <div className="flex justify-center mb-4">
            <span className="rounded-full bg-surface p-4 text-text-secondary">
              <Search size={36} />
            </span>
          </div>
          <p className="text-text-secondary">{t('labels.noResults')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedInvoices.map((invoice) => (
            <div key={invoice.id}>
              <Card id={`invoice-card-${invoice.id}`} className="group h-full">
                <div className="mb-3 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={selectedInvoiceIds.includes(invoice.id)}
                      onChange={() => toggleInvoiceSelection(invoice.id)}
                      className="accent-accent"
                    />
                    {t('labels.select')}
                  </label>
                  {bulkResults[invoice.id] && (
                    <span className={`text-xs ${bulkResults[invoice.id].success ? 'text-success' : 'text-red-400'}`}>
                      {bulkResults[invoice.id].success ? t('labels.resultSent') : `${t('labels.resultFailed')} ${bulkResults[invoice.id].error}`}
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-text-secondary">{invoice.invoice_number}</p>
                    <h3 className="text-lg font-semibold text-text-primary mt-1">
                      {invoice.clients?.name || t('labels.unknownClient')}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      {t('labels.projectPrefix')} {invoice.projects?.name || t('labels.unassigned')}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(invoice)}>
                    {t(`status.${invoice.status}`) || invoice.status}
                  </Badge>
                </div>

                <div className="flex items-end justify-between mt-4">
                  <div>
                    <p className="text-2xl font-bold text-text-primary">
                      {invoice.currency} {(invoice.total || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {t('labels.due')} {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Hover actions */}
                <div
                  data-html2canvas-ignore="true"
                  className="mt-4 flex items-center gap-2 border-t border-border pt-3 opacity-100 transition-opacity duration-250 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="inline-flex items-center gap-1 rounded-button px-2.5 py-1.5 text-sm text-text-secondary hover:text-accent"
                  >
                    <Eye size={15} />
                    {t('actions.viewLabel')}
                  </Link>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-button px-2.5 py-1.5 text-sm text-text-secondary hover:text-accent"
                  >
                    <Pencil size={15} />
                    {t('actions.edit')}
                  </Link>
                  <button
                    onClick={() => exportInvoicePdf(invoice)}
                    disabled={exportingId === invoice.id}
                    className="inline-flex items-center gap-1 rounded-button px-2.5 py-1.5 text-sm text-text-secondary hover:text-accent disabled:opacity-60"
                  >
                    <Download size={15} />
                    {exportingId === invoice.id ? t('actions.exporting') : t('actions.export')}
                  </button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {filteredInvoices.length > pageSize && (
        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-button border border-border bg-surface px-3 py-1 text-sm text-text-secondary disabled:opacity-50">{t('pagination.prev')}</button>
          <span className="text-sm text-text-secondary">{t('labels.page', { page, total: totalPages })}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-button border border-border bg-surface px-3 py-1 text-sm text-text-secondary disabled:opacity-50">{t('pagination.next')}</button>
        </div>
      )}
    </div>
  )
}
