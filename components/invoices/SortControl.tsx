'use client'

import { useTranslations } from 'next-intl'
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'
import {
  INVOICE_SORT_FIELDS,
  type InvoiceSortField,
  type SortDirection,
} from '@/lib/invoices/query'

interface SortControlProps {
  sort: InvoiceSortField
  dir: SortDirection
  onChange: (sort: InvoiceSortField, dir: SortDirection) => void
}

/**
 * Accessible sort picker: a labelled `<select>` for the field plus a toggle
 * button for the direction. The toggle exposes its state through `aria-pressed`
 * and a descriptive `aria-label` so screen-reader users know what flipping it
 * does.
 */
export default function SortControl({ sort, dir, onChange }: SortControlProps) {
  const t = useTranslations('invoices.list')

  const directionLabel = dir === 'asc' ? t('sort.ascending') : t('sort.descending')

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="invoice-sort" className="sr-only">
        {t('sort.label')}
      </label>
      <select
        id="invoice-sort"
        value={sort}
        onChange={(event) => onChange(event.target.value as InvoiceSortField, dir)}
        className="rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {INVOICE_SORT_FIELDS.map((field) => (
          <option key={field} value={field}>
            {t(`sort.fields.${field}`)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onChange(sort, dir === 'asc' ? 'desc' : 'asc')}
        aria-pressed={dir === 'asc'}
        aria-label={`${t('sort.toggleDirection')} (${directionLabel})`}
        title={`${t('sort.toggleDirection')} (${directionLabel})`}
        className="inline-flex items-center justify-center rounded-button border border-border bg-surface p-2 text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {dir === 'asc' ? (
          <ArrowUpNarrowWide size={16} aria-hidden="true" />
        ) : (
          <ArrowDownNarrowWide size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
