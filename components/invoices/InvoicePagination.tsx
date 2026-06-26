'use client'

import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '@/lib/invoices/query'

interface InvoicePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/**
 * Server-side pagination control with a page-size selector.
 *
 * Accessibility:
 * - Wrapped in a `<nav aria-label>` landmark.
 * - Prev/Next are real `<button>`s, disabled (and removed from the tab order
 *   via `disabled`) at the bounds, each with a descriptive `aria-label`.
 * - The "Page X of Y" status is an `aria-live="polite"` region so changes are
 *   announced.
 * - The page-size `<select>` has an associated visible-or-`sr-only` `<label>`.
 */
export default function InvoicePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: InvoicePaginationProps) {
  const t = useTranslations('invoices.list')

  const safePageSize = pageSize > 0 ? pageSize : PAGE_SIZE_OPTIONS[0]
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const from = total === 0 ? 0 : (currentPage - 1) * safePageSize + 1
  const to = Math.min(currentPage * safePageSize, total)

  return (
    <nav
      aria-label={t('pagination.label')}
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2">
        <label htmlFor="invoice-page-size" className="text-sm text-text-secondary">
          {t('pagination.perPage')}
        </label>
        <select
          id="invoice-page-size"
          value={safePageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          aria-label={t('pagination.perPageLabel')}
          className="rounded-button border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="text-sm text-text-secondary">
          {t('pagination.summary', { from, to, total })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label={t('pagination.previous')}
          className="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 disabled:hover:text-text-secondary"
        >
          <ChevronLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
          <span className="hidden sm:inline">{t('pagination.previous')}</span>
        </button>

        <span aria-live="polite" className="min-w-[7rem] text-center text-sm text-text-secondary">
          {t('pagination.page', { page: currentPage, total: totalPages })}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label={t('pagination.next')}
          className="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 disabled:hover:text-text-secondary"
        >
          <span className="hidden sm:inline">{t('pagination.next')}</span>
          <ChevronRight size={16} aria-hidden="true" className="rtl:rotate-180" />
        </button>
      </div>
    </nav>
  )
}
