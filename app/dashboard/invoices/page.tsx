'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from '@/hooks/useDebounce'
import { useInvoicesQuery, type InvoiceListRow, type InvoiceQueryError } from '@/hooks/useInvoicesQuery'
import {
  parseInvoiceParams,
  serializeInvoiceParams,
  INVOICE_STATUSES,
  DEFAULT_SORT,
  DEFAULT_DIRECTION,
  type InvoiceQueryParams,
  type InvoiceSortField,
  type SortDirection,
} from '@/lib/invoices/query'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { formatCurrencyAmount } from '@/lib/currency'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { CardGridSkeleton } from '@/components/LoadingSkeleton'
import InvoiceFilterBar, { type FilterOption } from '@/components/invoices/InvoiceFilterBar'
import SortControl from '@/components/invoices/SortControl'
import InvoicePagination from '@/components/invoices/InvoicePagination'
import BulkActionBar from '@/components/invoices/BulkActionBar'
import { Plus, Search, Eye, Pencil, Download, Inbox, AlertTriangle } from 'lucide-react'

function isOverdue(invoice: InvoiceListRow) {
  return invoice.status !== 'paid' && !!invoice.due_date && new Date(invoice.due_date) < new Date()
}

function statusBadgeVariant(invoice: InvoiceListRow): 'success' | 'warning' | 'danger' {
  if (invoice.status === 'paid') return 'success'
  if (invoice.status === 'overdue' || invoice.status === 'disputed' || isOverdue(invoice)) return 'danger'
  return 'warning'
}

function InvoicesPageInner() {
  const t = useTranslations('invoices')
  const tList = useTranslations('invoices.list')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const advanced = isFeatureEnabled('invoiceListV2')

  const params = useMemo(
    () => parseInvoiceParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const { invoices, total, page, pageSize, loading, error, refetch } = useInvoicesQuery(params)

  // ---- URL state helpers --------------------------------------------------
  const updateParams = useCallback(
    (next: Partial<InvoiceQueryParams>, options?: { resetPage?: boolean }) => {
      const merged: InvoiceQueryParams = { ...params, ...next }
      if (options?.resetPage !== false) merged.page = 1
      const query = serializeInvoiceParams(merged).toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  // ---- Debounced search synced to the URL ---------------------------------
  const [searchInput, setSearchInput] = useState(params.search ?? '')
  const debouncedSearch = useDebounce(searchInput, 300)
  const lastPushedSearch = useRef(params.search ?? '')

  useEffect(() => {
    if ((params.search ?? '') !== debouncedSearch) {
      lastPushedSearch.current = debouncedSearch
      updateParams({ search: debouncedSearch || undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    const external = params.search ?? ''
    if (external !== lastPushedSearch.current) {
      lastPushedSearch.current = external
      setSearchInput(external)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.search])

  // ---- Client/project options for the filter bar --------------------------
  const [clients, setClients] = useState<FilterOption[]>([])
  const [projects, setProjects] = useState<FilterOption[]>([])

  useEffect(() => {
    if (!advanced) return
    let cancelled = false
    async function loadOptions() {
      const supabase = createClient()
      if (!supabase) return
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) return
      const [{ data: clientData }, { data: projectData }] = await Promise.all([
        supabase.from('clients').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('projects').select('id, name').eq('user_id', user.id).order('name'),
      ])
      if (cancelled) return
      setClients((clientData as FilterOption[]) || [])
      setProjects((projectData as FilterOption[]) || [])
    }
    loadOptions()
    return () => {
      cancelled = true
    }
  }, [advanced])

  // ---- Selection (bulk actions live in BulkActionBar) ----------------------
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [exportingId, setExportingId] = useState<string | null>(null)

  const allPageSelected = invoices.length > 0 && invoices.every((invoice) => selectedIds.includes(invoice.id))

  function toggleSelection(invoiceId: string) {
    setSelectedIds((prev) =>
      prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId],
    )
  }

  function togglePageSelection() {
    const pageIds = invoices.map((invoice) => invoice.id)
    setSelectedIds((prev) =>
      allPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds])),
    )
  }

  async function exportInvoicePdf(invoice: InvoiceListRow) {
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
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] })
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

  // ---- Derived view state -------------------------------------------------
  const sort: InvoiceSortField = params.sort ?? DEFAULT_SORT
  const dir: SortDirection = params.dir ?? DEFAULT_DIRECTION
  const hasActiveQuery = !!params.search || activeFilterCount(params) > 0
  const showSkeleton = loading && invoices.length === 0

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card hoverGlow={false} className="max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <AlertTriangle size={44} className="text-red-400" />
          </div>
          <p className="mb-4 text-text-secondary">
            {t('errorLabel')}: {describeError(error, tList)}
          </p>
          <Button onClick={() => refetch()}>{tList('errors.retry')}</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button>
            <Plus size={16} />
            {t('actions.newInvoice')}
          </Button>
        </Link>
      </div>

      {/* Search + sort + filters */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-secondary ltr:left-3 rtl:right-3"
          />
          <label htmlFor="invoice-search" className="sr-only">
            {tList('search.label')}
          </label>
          <input
            id="invoice-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={tList('search.placeholder')}
            className="w-full rounded-button border border-border bg-surface py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 ltr:pl-9 ltr:pr-3 rtl:pl-3 rtl:pr-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {advanced ? (
            <InvoiceFilterBar
              params={params}
              clients={clients}
              projects={projects}
              onApply={(next) => updateParams(next)}
              onClear={() =>
                updateParams(
                  {
                    status: undefined,
                    clientId: undefined,
                    projectId: undefined,
                    from: undefined,
                    to: undefined,
                    minAmount: undefined,
                    maxAmount: undefined,
                    tags: undefined,
                    metaKey: undefined,
                    metaValue: undefined,
                  },
                )
              }
            />
          ) : (
            <select
              aria-label={tList('filters.status')}
              value={params.status?.[0] ?? ''}
              onChange={(event) =>
                updateParams({ status: event.target.value ? [event.target.value] : undefined })
              }
              className="rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">{t('filters.all')}</option>
              {INVOICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tList(`status.${status}`)}
                </option>
              ))}
            </select>
          )}
          <SortControl sort={sort} dir={dir} onChange={(nextSort, nextDir) => updateParams({ sort: nextSort, dir: nextDir })} />
        </div>
      </div>

      {/* Bulk controls */}
      {invoices.length > 0 && (
        <div className="mb-4 space-y-3">
          <button
            onClick={togglePageSelection}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {allPageSelected ? t('actions.unselectPage') : t('actions.selectPage')}
          </button>
          <BulkActionBar
            selectedIds={selectedIds}
            invoices={invoices}
            params={params}
            locale={locale}
            onChangeSelection={setSelectedIds}
            onDone={refetch}
          />
        </div>
      )}

      {/* Results */}
      {showSkeleton ? (
        <CardGridSkeleton />
      ) : invoices.length === 0 ? (
        <Card hoverGlow={false} className="py-12 text-center">
          <div className="mb-4 flex justify-center">
            <span className="rounded-full bg-surface p-4 text-text-secondary">
              {hasActiveQuery ? <Search size={36} /> : <Inbox size={36} />}
            </span>
          </div>
          <p className="mb-2 text-text-secondary">
            {hasActiveQuery ? tList('results.noMatches') : tList('results.empty')}
          </p>
          <p className="mb-4 text-sm text-text-secondary">
            {hasActiveQuery ? tList('results.noMatchesHint') : tList('results.emptyHint')}
          </p>
          {!hasActiveQuery && (
            <Link href="/dashboard/invoices/new">
              <Button>
                <Plus size={16} />
                {t('actions.newInvoice')}
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-text-secondary" aria-live="polite">
            {tList('results.total', { total })}
          </p>
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity md:grid-cols-2 lg:grid-cols-3 ${
              loading ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {invoices.map((invoice) => (
              <div key={invoice.id}>
                <Card id={`invoice-card-${invoice.id}`} className="group h-full">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(invoice.id)}
                        onChange={() => toggleSelection(invoice.id)}
                        aria-label={tList('row.selectOne', { number: invoice.invoice_number })}
                        className="accent-accent"
                      />
                      {t('labels.select')}
                    </label>
                  </div>

                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="text-sm text-text-secondary">{invoice.invoice_number}</p>
                      <h3 className="mt-1 text-lg font-semibold text-text-primary">
                        {invoice.client_name || tList('row.unknownClient')}
                      </h3>
                      <p className="mt-1 text-xs text-text-secondary">
                        {t('labels.projectPrefix')} {invoice.project_name || tList('row.noProject')}
                      </p>
                      {invoice.tags && invoice.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {invoice.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge variant={statusBadgeVariant(invoice)}>
                      {tList(`status.${invoice.status}`) || invoice.status}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-text-primary">
                        {formatCurrencyAmount(invoice.total || 0, invoice.currency, locale)}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {tList('row.dueLabel')}{' '}
                        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString(locale) : '—'}
                      </p>
                    </div>
                  </div>

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

          <InvoicePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => updateParams({ page: nextPage }, { resetPage: false })}
            onPageSizeChange={(nextSize) => updateParams({ pageSize: nextSize })}
          />
        </>
      )}
    </div>
  )
}

function activeFilterCount(params: InvoiceQueryParams): number {
  let count = 0
  if (params.status && params.status.length > 0) count += 1
  if (params.clientId) count += 1
  if (params.projectId) count += 1
  if (params.from) count += 1
  if (params.to) count += 1
  if (params.minAmount != null) count += 1
  if (params.maxAmount != null) count += 1
  if (params.tags && params.tags.length > 0) count += 1
  if (params.metaKey && params.metaValue) count += 1
  return count
}

function describeError(error: InvoiceQueryError, tList: ReturnType<typeof useTranslations>): string {
  if (error.kind === 'supabaseInit') return tList('errors.supabaseInit')
  if (error.kind === 'loginRequired') return tList('errors.loginRequired')
  return error.message || tList('errors.query')
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<CardGridSkeleton withToolbar />}>
      <InvoicesPageInner />
    </Suspense>
  )
}
