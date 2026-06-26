'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { INVOICE_STATUSES, type InvoiceQueryParams } from '@/lib/invoices/query'

export interface FilterOption {
  id: string
  name: string
}

interface InvoiceFilterBarProps {
  params: InvoiceQueryParams
  clients: FilterOption[]
  projects: FilterOption[]
  /** Receives only the filter-related fields; the page merges sort/search/page. */
  onApply: (next: Partial<InvoiceQueryParams>) => void
  onClear: () => void
}

interface Draft {
  status: string[]
  clientId: string
  projectId: string
  from: string
  to: string
  minAmount: string
  maxAmount: string
  tags: string
  metaKey: string
  metaValue: string
}

function paramsToDraft(params: InvoiceQueryParams): Draft {
  return {
    status: params.status ?? [],
    clientId: params.clientId ?? '',
    projectId: params.projectId ?? '',
    from: params.from ?? '',
    to: params.to ?? '',
    minAmount: params.minAmount != null ? String(params.minAmount) : '',
    maxAmount: params.maxAmount != null ? String(params.maxAmount) : '',
    tags: (params.tags ?? []).join(', '),
    metaKey: params.metaKey ?? '',
    metaValue: params.metaValue ?? '',
  }
}

function parseTags(value: string): string[] | undefined {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return tags.length > 0 ? tags : undefined
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function countActiveFilters(params: InvoiceQueryParams): number {
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

const fieldClass =
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
const labelClass = 'block text-xs font-medium mb-1 text-text-secondary'

/**
 * Advanced, URL-synced invoice filters (status, date range, client, project,
 * amount range, tags and a custom metadata facet). Edits are staged in a local
 * draft and only committed on "Apply" to avoid a query per keystroke; the panel
 * re-syncs to `params` when they change externally (e.g. the browser back
 * button). Fully keyboard operable with an `aria-expanded` toggle and a labelled
 * status `<fieldset>`.
 */
export default function InvoiceFilterBar({
  params,
  clients,
  projects,
  onApply,
  onClear,
}: InvoiceFilterBarProps) {
  const t = useTranslations('invoices.list')
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => paramsToDraft(params))

  const activeCount = useMemo(() => countActiveFilters(params), [params])

  // Re-sync the draft when the applied params change from outside this component.
  const syncKey = JSON.stringify([
    params.status,
    params.clientId,
    params.projectId,
    params.from,
    params.to,
    params.minAmount,
    params.maxAmount,
    params.tags,
    params.metaKey,
    params.metaValue,
  ])
  useEffect(() => {
    setDraft(paramsToDraft(params))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey])

  function toggleStatus(status: string) {
    setDraft((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((value) => value !== status)
        : [...prev.status, status],
    }))
  }

  function handleApply() {
    onApply({
      status: draft.status.length > 0 ? draft.status : undefined,
      clientId: draft.clientId || undefined,
      projectId: draft.projectId || undefined,
      from: draft.from || undefined,
      to: draft.to || undefined,
      minAmount: parseNumber(draft.minAmount),
      maxAmount: parseNumber(draft.maxAmount),
      tags: parseTags(draft.tags),
      metaKey: draft.metaKey.trim() || undefined,
      metaValue: draft.metaValue.trim() || undefined,
    })
    setOpen(false)
  }

  function handleClear() {
    onClear()
    setOpen(false)
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {t('filters.toggle')}
        {activeCount > 0 && (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={t('filters.heading')}
          className="mt-3 rounded-card border border-border bg-surface p-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <fieldset className="sm:col-span-2 lg:col-span-3">
              <legend className={labelClass}>{t('filters.status')}</legend>
              <div className="flex flex-wrap gap-2">
                {INVOICE_STATUSES.map((status) => {
                  const checked = draft.status.includes(status)
                  return (
                    <label
                      key={status}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-button border px-3 py-1.5 text-sm transition-colors ${
                        checked
                          ? 'border-accent bg-accent/10 text-text-primary'
                          : 'border-border bg-background text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={checked}
                        onChange={() => toggleStatus(status)}
                      />
                      {t(`status.${status}`)}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="filter-client" className={labelClass}>
                {t('filters.client')}
              </label>
              <select
                id="filter-client"
                value={draft.clientId}
                onChange={(event) => setDraft((prev) => ({ ...prev, clientId: event.target.value }))}
                className={fieldClass}
              >
                <option value="">{t('filters.allClients')}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-project" className={labelClass}>
                {t('filters.project')}
              </label>
              <select
                id="filter-project"
                value={draft.projectId}
                onChange={(event) => setDraft((prev) => ({ ...prev, projectId: event.target.value }))}
                className={fieldClass}
              >
                <option value="">{t('filters.allProjects')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="filter-from" className={labelClass}>
                  {t('filters.dateFrom')}
                </label>
                <input
                  id="filter-from"
                  type="date"
                  value={draft.from}
                  onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="filter-to" className={labelClass}>
                  {t('filters.dateTo')}
                </label>
                <input
                  id="filter-to"
                  type="date"
                  value={draft.to}
                  onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="filter-min" className={labelClass}>
                  {t('filters.minAmount')}
                </label>
                <input
                  id="filter-min"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.minAmount}
                  onChange={(event) => setDraft((prev) => ({ ...prev, minAmount: event.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="filter-max" className={labelClass}>
                  {t('filters.maxAmount')}
                </label>
                <input
                  id="filter-max"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.maxAmount}
                  onChange={(event) => setDraft((prev) => ({ ...prev, maxAmount: event.target.value }))}
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-tags" className={labelClass}>
                {t('filters.tags')}
              </label>
              <input
                id="filter-tags"
                type="text"
                value={draft.tags}
                onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder={t('filters.tagsPlaceholder')}
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="filter-meta-key" className={labelClass}>
                  {t('filters.metaKey')}
                </label>
                <input
                  id="filter-meta-key"
                  type="text"
                  value={draft.metaKey}
                  onChange={(event) => setDraft((prev) => ({ ...prev, metaKey: event.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="filter-meta-value" className={labelClass}>
                  {t('filters.metaValue')}
                </label>
                <input
                  id="filter-meta-value"
                  type="text"
                  value={draft.metaValue}
                  onChange={(event) => setDraft((prev) => ({ ...prev, metaValue: event.target.value }))}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleClear}>
              <X size={15} aria-hidden="true" />
              {t('filters.clear')}
            </Button>
            <Button size="sm" onClick={handleApply}>
              {t('filters.apply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
