'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/client'
import { FormPageSkeleton } from '@/components/LoadingSkeleton'
import { generateInvoiceNumber } from '@/lib/invoiceNumber'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import CSVUploader from '@/components/CSVUploader'
import SmartCurrencyTax from '@/components/SmartCurrencyTax'
import { useSmartDetection } from '@/hooks/useSmartDetection'
import { useAutoSaveDraft } from '@/hooks/useAutoSaveDraft'
import {
  computeInvoiceMoney,
  round2,
  type DiscountType,
  type TaxMode,
} from '@/lib/invoices/money'
import TemplateSelector from '@/components/invoices/TemplateSelector'
import LivePreview from '@/components/invoices/LivePreview'
import {
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  INVOICE_TEMPLATE_STORAGE_KEY,
  resolveInvoiceTemplate,
  sanitizeInvoiceTemplateSettings,
  type InvoiceTemplateSettings,
} from '@/lib/invoiceTemplate'
import { computeInvoiceSeal } from '@/lib/invoices/seal'
import { isFeatureEnabled } from '@/lib/featureFlags'
import FeatureGate from '@/components/FeatureGate'
import { FEATURES } from '@/lib/subscriptions/plans'
import AILineItemAssistant, { type AIGeneratedResult } from '@/components/invoices/AILineItemAssistant'
import BrandingControls from '@/components/invoices/BrandingControls'
import SignatureSeal from '@/components/invoices/SignatureSeal'
import UpgradePrompt from '@/components/UpgradePrompt'
import { ArrowLeft, Users, CalendarDays, ListPlus, Percent, StickyNote, Plus, Trash2 } from 'lucide-react'

interface ClientItem {
  id: string
  name: string
  email?: string
}

interface ProjectItem {
  id: string
  name: string
}

interface EditorLineItem {
  description: string
  quantity: number
  price: number
  /** Per-line tax rate (%); '' inherits the invoice-level rate. */
  taxRate: number | ''
}

export interface InvoiceEditorProps {
  mode: 'create' | 'edit'
  invoiceId?: string
}

const emptyItem: EditorLineItem = { description: '', quantity: 1, price: 0, taxRate: '' }

// Rounding-increment choices surfaced in the editor (0 = no rounding).
const ROUNDING_OPTIONS = [0, 0.05, 0.1, 0.5, 1]

const inputClass =
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
const labelClass = 'block text-sm font-medium mb-1 text-text-secondary'

/**
 * Unified, localized invoice editor shared by the create and edit pages (behind
 * the `invoiceEditorV2` flag). Adds multi-rate per-line tax, an inclusive/
 * exclusive tax mode, a fixed/percentage discount and optional total rounding on
 * top of the original form, plus client/project linking validation and local +
 * server draft auto-save. The richer breakdown is persisted in the existing
 * JSONB columns (`items[].taxRate`, `metadata.{discount,taxMode,roundingIncrement}`)
 * while the `subtotal`/`tax_amount`/`total`/`tax_rate_percentage` roll-ups keep
 * powering the list, export and payment features.
 */
export default function InvoiceEditor({ mode, invoiceId }: InvoiceEditorProps) {
  const t = useTranslations('invoices')
  const locale = useLocale()
  const router = useRouter()
  const isEdit = mode === 'edit'

  const {
    currency,
    taxRate,
    taxType,
    detected,
    autoDetect,
    manualOverride,
    detecting,
    error: detectionError,
    rates,
    setCurrency,
    setTaxRate,
    setAutoDetect,
    redetect,
  } = useSmartDetection({ enabled: mode === 'create', persist: mode === 'create' })

  const [clients, setClients] = useState<ClientItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<EditorLineItem[]>([{ ...emptyItem }])
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  )
  const [notes, setNotes] = useState('')
  const [taxMode, setTaxMode] = useState<TaxMode>('exclusive')
  const [discountType, setDiscountType] = useState<DiscountType>('percent')
  const [discountValue, setDiscountValue] = useState(0)
  const [roundingIncrement, setRoundingIncrement] = useState(0)

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [existingMetadata, setExistingMetadata] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [templateSettings, setTemplateSettings] = useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_TEMPLATE_SETTINGS)
  const [usingGlobalTemplate, setUsingGlobalTemplate] = useState(true)

  // Reads the user's global default template (Settings) from localStorage; the
  // editor seeds new invoices from it and falls back to it when an invoice has
  // no per-invoice template yet.
  const readGlobalTemplate = (): InvoiceTemplateSettings => {
    if (typeof window === 'undefined') return DEFAULT_INVOICE_TEMPLATE_SETTINGS
    const raw = window.localStorage.getItem(INVOICE_TEMPLATE_STORAGE_KEY)
    if (!raw) return DEFAULT_INVOICE_TEMPLATE_SETTINGS
    try {
      return sanitizeInvoiceTemplateSettings(JSON.parse(raw))
    } catch {
      return DEFAULT_INVOICE_TEMPLATE_SETTINGS
    }
  }

  // Any manual template edit makes the invoice carry its own template override.
  const handleTemplateChange = (next: InvoiceTemplateSettings) => {
    setTemplateSettings(next)
    setUsingGlobalTemplate(false)
  }

  const money = useMemo(
    () =>
      computeInvoiceMoney({
        items: items.map((item) => ({
          quantity: item.quantity,
          price: item.price,
          taxRate: item.taxRate === '' ? null : item.taxRate,
        })),
        invoiceTaxRate: taxRate,
        taxMode,
        discount: { type: discountType, value: discountValue },
        roundingIncrement,
      }),
    [items, taxRate, taxMode, discountType, discountValue, roundingIncrement],
  )

  // Phase 6 (AI generation + branding + signature/seal) rides this flag.
  const generationEnabled = isFeatureEnabled('invoiceGenerationV2')

  // Live tamper-evident verification code for the preview/seal controls. The
  // authoritative seal on the final invoice is recomputed at render time from
  // the persisted invoice; here we use today's date as the issue date.
  const sealCode = useMemo(
    () =>
      computeInvoiceSeal({
        invoiceNumber: invoiceNumber || undefined,
        total: money.total,
        currency,
        issueDate: new Date().toISOString().slice(0, 10),
      }).code,
    [invoiceNumber, money.total, currency],
  )

  // Merge AI-generated content into the form: append items (dropping any blank
  // starter row) and append the notes summary, never discarding manual input.
  const handleAiApply = ({ items: generatedItems, notes: generatedNotes }: AIGeneratedResult) => {
    setItems((prev) => {
      const existing = prev.filter((item) => item.description.trim() !== '' || Number(item.price) > 0)
      const mapped = generatedItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        taxRate: '' as const,
      }))
      return existing.length ? [...existing, ...mapped] : mapped
    })
    const trimmed = (generatedNotes || '').trim()
    if (trimmed) {
      setNotes((prev) => (prev && prev.trim() ? `${prev.trim()}\n${trimmed}` : trimmed))
    }
  }

  // Snapshot of all editable fields, auto-saved (debounced) locally + server-side.
  const draftData = useMemo(
    () => ({
      clientId,
      projectId,
      dueDate,
      notes,
      items,
      currency,
      taxRate,
      taxMode,
      discountType,
      discountValue,
      roundingIncrement,
      template: templateSettings,
    }),
    [clientId, projectId, dueDate, notes, items, currency, taxRate, taxMode, discountType, discountValue, roundingIncrement, templateSettings],
  )

  const draftKey = isEdit && invoiceId ? invoiceId : 'new'
  const {
    status: autoSaveStatus,
    availableDraft,
    restore,
    clear: clearDraft,
    dismiss: dismissDraft,
  } = useAutoSaveDraft({ draftKey, data: draftData, enabled: !loading && !submitted })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const supabase = createClient()
      if (!supabase) {
        setError(t('new.errors.supabaseInit'))
        setLoading(false)
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setError(t('new.errors.loginRequired'))
        setLoading(false)
        return
      }

      const [{ data: clientData, error: clientsError }, { data: projectData, error: projectsError }] =
        await Promise.all([
          supabase.from('clients').select('id, name, email').eq('user_id', user.id).order('name', { ascending: true }),
          supabase.from('projects').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
        ])

      if (clientsError || projectsError) {
        setError(clientsError?.message || projectsError?.message || t('new.errors.loadDependencies'))
        setLoading(false)
        return
      }

      if (cancelled) return
      setClients(clientData || [])
      setProjects((projectData as ProjectItem[]) || [])

      const globalTemplate = readGlobalTemplate()
      setTemplateSettings(globalTemplate)
      setUsingGlobalTemplate(true)

      if (isEdit && invoiceId) {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user.id)
          .eq('id', invoiceId)
          .single()

        if (invoiceError || !invoice) {
          if (!cancelled) {
            setError(invoiceError?.message || t('editor.errors.notFound'))
            setLoading(false)
          }
          return
        }

        if (cancelled) return
        setClientId(invoice.client_id || '')
        setProjectId(invoice.project_id || '')
        setDueDate(invoice.due_date || dueDate)
        setNotes(invoice.notes || '')
        setInvoiceNumber(invoice.invoice_number || '')
        const loadedItems = Array.isArray(invoice.items) && invoice.items.length ? invoice.items : [{ ...emptyItem }]
        setItems(
          loadedItems.map((item: Record<string, unknown>) => ({
            description: typeof item.description === 'string' ? item.description : '',
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            taxRate: typeof item.taxRate === 'number' ? item.taxRate : '',
          })),
        )
        setCurrency(invoice.currency || 'USD')
        setTaxRate(Number(invoice.tax_rate_percentage) || 0)

        const metadata = (invoice.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {}) as Record<
          string,
          unknown
        >
        setExistingMetadata(metadata)
        const discount = metadata.discount as { type?: string; value?: number } | undefined
        if (discount) {
          setDiscountType(discount.type === 'fixed' ? 'fixed' : 'percent')
          setDiscountValue(Number(discount.value) || 0)
        }
        if (metadata.taxMode === 'inclusive') setTaxMode('inclusive')
        if (typeof metadata.roundingIncrement === 'number') setRoundingIncrement(metadata.roundingIncrement)

        const hasPerInvoiceTemplate = Boolean(metadata.template && typeof metadata.template === 'object')
        setTemplateSettings(resolveInvoiceTemplate(metadata, globalTemplate))
        setUsingGlobalTemplate(!hasPerInvoiceTemplate)
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, invoiceId])

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }])
  const removeItem = (index: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const updateItem = (index: number, key: keyof EditorLineItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (key === 'description') return { ...item, description: value }
        if (key === 'taxRate') return { ...item, taxRate: value === '' ? '' : Number(value) }
        return { ...item, [key]: Number(value) }
      }),
    )
  }

  const handleCSVData = (data: Record<string, string>[]) => {
    const parsed = data
      .map((row) => ({
        description: row['description'] || row['Description'] || row['name'] || row['Name'] || '',
        quantity: Number(row['quantity'] || row['Quantity'] || row['qty'] || row['Qty'] || 1),
        price: Number(row['price'] || row['Price'] || row['rate'] || row['Rate'] || row['amount'] || row['Amount'] || 0),
        taxRate: '' as const,
      }))
      .filter((item) => item.description.trim() !== '')
    if (parsed.length > 0) setItems(parsed)
  }

  const applyDraft = (payload: Record<string, unknown>) => {
    if (typeof payload.clientId === 'string') setClientId(payload.clientId)
    if (typeof payload.projectId === 'string') setProjectId(payload.projectId)
    if (typeof payload.dueDate === 'string') setDueDate(payload.dueDate)
    if (typeof payload.notes === 'string') setNotes(payload.notes)
    if (Array.isArray(payload.items)) {
      setItems(
        (payload.items as Record<string, unknown>[]).map((item) => ({
          description: typeof item.description === 'string' ? item.description : '',
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          taxRate: typeof item.taxRate === 'number' ? item.taxRate : '',
        })),
      )
    }
    if (typeof payload.currency === 'string') setCurrency(payload.currency)
    if (typeof payload.taxRate === 'number') setTaxRate(payload.taxRate)
    if (payload.taxMode === 'inclusive' || payload.taxMode === 'exclusive') setTaxMode(payload.taxMode)
    if (payload.discountType === 'fixed' || payload.discountType === 'percent') setDiscountType(payload.discountType)
    if (typeof payload.discountValue === 'number') setDiscountValue(payload.discountValue)
    if (typeof payload.roundingIncrement === 'number') setRoundingIncrement(payload.roundingIncrement)
    if (payload.template && typeof payload.template === 'object') {
      setTemplateSettings(sanitizeInvoiceTemplateSettings(payload.template))
      setUsingGlobalTemplate(false)
    }
  }

  const handleRestore = async () => {
    const payload = await restore()
    if (payload) applyDraft(payload)
    dismissDraft()
  }

  const validate = (): string | null => {
    if (!clientId) return t('new.errors.selectClient')
    if (projectId && !projects.some((project) => project.id === projectId)) return t('editor.errors.projectInvalid')
    if (!dueDate) return t('new.errors.dueDateRequired')
    if (!items.length) return t('new.errors.itemRequired')
    if (Number(taxRate) < 0 || Number(taxRate) > 100) return t('new.errors.taxRateInvalid')

    for (const item of items) {
      if (!item.description.trim()) return t('new.errors.itemDescriptionRequired')
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return t('new.errors.itemQuantityInvalid')
      if (!Number.isFinite(item.price) || item.price < 0) return t('new.errors.itemPriceNegative')
      if (item.taxRate !== '' && (item.taxRate < 0 || item.taxRate > 100)) return t('new.errors.taxRateInvalid')
    }

    if (money.subtotal <= 0) return t('new.errors.subtotalInvalid')
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const supabase = createClient()
    if (!supabase) {
      setError(t('new.errors.supabaseInit'))
      return
    }

    setSubmitting(true)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setSubmitting(false)
      setError(t('new.errors.loginToCreate'))
      return
    }

    const normalizedItems = items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      price: Number(item.price),
      taxRate: item.taxRate === '' ? null : Number(item.taxRate),
      total: round2(Number(item.quantity) * Number(item.price)),
    }))

    const selectedClient = clients.find((client) => client.id === clientId)
    const selectedProject = projects.find((project) => project.id === projectId)
    const metadata = {
      ...existingMetadata,
      discount: { type: discountType, value: round2(discountValue), amount: money.discountAmount },
      taxMode,
      roundingIncrement: roundingIncrement || 0,
      template: templateSettings,
    }

    const shared = {
      client_id: clientId,
      project_id: projectId || null,
      client_name: selectedClient?.name || null,
      project_name: selectedProject?.name || null,
      items: normalizedItems,
      subtotal: money.subtotal,
      tax_rate_percentage: money.effectiveTaxRate,
      tax_amount: money.taxAmount,
      total: money.total,
      currency,
      due_date: dueDate,
      notes,
      metadata,
    }

    try {
      let targetId = invoiceId || null

      return await Sentry.startSpan({ name: `invoices.editor.${mode}`, op: 'db.write' }, async () => {
        if (isEdit && invoiceId) {
          const { error: updateError } = await supabase.from('invoices').update(shared).eq('id', invoiceId)
          if (updateError) throw new Error(updateError.message)
          setSuccess(t('editor.updatedToast'))
        } else {
          const number = await generateInvoiceNumber(user.id)
          const { data: created, error: insertError } = await supabase
            .from('invoices')
            .insert({ user_id: user.id, invoice_number: number, status: 'draft', ...shared })
            .select('id')
            .single()
          if (insertError) throw new Error(insertError.message)
          targetId = created?.id ?? null
          setSuccess(t('new.successCreated', { number }))
        }

        setSubmitted(true)
        await clearDraft()
        router.push(targetId ? `/dashboard/invoices/${targetId}` : '/dashboard/invoices')
      })
    } catch (submitError) {
      Sentry.captureException(submitError)
      setError(
        submitError instanceof Error
          ? submitError.message
          : isEdit
            ? t('editor.errors.updateFailed')
            : t('new.errors.createFailed'),
      )
      setSubmitting(false)
    }
  }

  if (loading) {
    return <FormPageSkeleton fields={8} />
  }

  const title = isEdit ? t('editor.editTitle', { number: invoiceNumber }) : t('editor.createTitle')
  const submitLabel = isEdit
    ? submitting
      ? t('editor.saving')
      : t('editor.saveCta')
    : submitting
      ? t('editor.creating')
      : t('editor.createCta')

  const autoSaveText =
    autoSaveStatus === 'saving'
      ? t('editor.autosave.saving')
      : autoSaveStatus === 'saved'
        ? t('editor.autosave.saved')
        : autoSaveStatus === 'error'
          ? t('editor.autosave.error')
          : t('editor.autosave.idle')

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{title}</h1>
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent"
          >
            <ArrowLeft size={15} />
            {t('new.backToInvoices')}
          </Link>
        </div>

        {/* Restore an auto-saved draft */}
        {availableDraft && (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-button border border-accent/40 bg-accent/10 px-4 py-3 text-sm"
          >
            <span className="text-text-primary">
              {availableDraft.savedAt
                ? t('editor.draft.restoreBody', { time: new Date(availableDraft.savedAt).toLocaleString(locale) })
                : t('editor.draft.restoreTitle')}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleRestore}>
                {t('editor.draft.restoreAction')}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={dismissDraft}>
                {t('editor.draft.discardAction')}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          {error && (
            <div className="rounded-button border border-red-500/30 bg-red-500/10 text-red-400 px-4 py-3 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-button border border-success/30 bg-success/10 text-success px-4 py-3 text-sm">
              {success}
            </div>
          )}

          {/* AI line-item assistant (gated server-side to Pro+) */}
          {generationEnabled && (
            <AILineItemAssistant currency={currency} locale={locale} onApply={handleAiApply} />
          )}

          {/* Client & Project */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent">
                <Users size={16} />
              </span>
              <h2 className="font-semibold text-text-primary">{t('new.client')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoice-client" className={labelClass}>
                  {t('new.client')}
                </label>
                <select
                  id="invoice-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t('new.selectClientPlaceholder')}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.email ? `(${client.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="invoice-project" className={labelClass}>
                  {t('new.project')}
                </label>
                <select
                  id="invoice-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t('new.noProject')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Due date */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent">
                <CalendarDays size={16} />
              </span>
              <h2 className="font-semibold text-text-primary">{t('new.dueDate')}</h2>
            </div>
            <div>
              <label htmlFor="invoice-due-date" className={labelClass}>
                {t('new.dueDate')}
              </label>
              <input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </Card>

          {/* Smart currency & invoice-level tax */}
          <SmartCurrencyTax
            variant="dark"
            currency={currency}
            taxRate={taxRate}
            taxType={taxType}
            detected={detected}
            autoDetect={autoDetect}
            manualOverride={manualOverride}
            detecting={detecting}
            error={detectionError}
            rates={rates}
            onCurrencyChange={setCurrency}
            onTaxRateChange={setTaxRate}
            onAutoDetectChange={setAutoDetect}
            onRedetect={redetect}
            labels={{ currencyLabel: t('new.currency'), taxLabel: t('new.taxRate') }}
          />

          {/* Line items */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-button bg-accent/10 p-1.5 text-accent">
                  <ListPlus size={16} />
                </span>
                <h2 className="font-semibold text-text-primary">{t('new.items')}</h2>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                <Plus size={15} />
                {t('new.addItem')}
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-text-secondary mb-2">{t('new.csvUploadLabel')}</p>
              <CSVUploader onDataLoaded={handleCSVData} />
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <label htmlFor={`item-description-${index}`} className="sr-only">
                    {t('new.itemDescription')}
                  </label>
                  <input
                    id={`item-description-${index}`}
                    className={`md:col-span-5 ${inputClass}`}
                    placeholder={t('new.itemDescription')}
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                  <label htmlFor={`item-quantity-${index}`} className="sr-only">
                    {t('new.itemQuantity')}
                  </label>
                  <input
                    id={`item-quantity-${index}`}
                    className={`md:col-span-2 ${inputClass}`}
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  />
                  <label htmlFor={`item-price-${index}`} className="sr-only">
                    {t('new.itemRate')}
                  </label>
                  <input
                    id={`item-price-${index}`}
                    className={`md:col-span-2 ${inputClass}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', e.target.value)}
                  />
                  <label htmlFor={`item-tax-${index}`} className="sr-only">
                    {t('editor.lineTaxRate')}
                  </label>
                  <input
                    id={`item-tax-${index}`}
                    className={`md:col-span-2 ${inputClass}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder={t('editor.lineTaxRate')}
                    value={item.taxRate}
                    onChange={(e) => updateItem(index, 'taxRate', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="md:col-span-1 inline-flex items-center justify-center text-red-400 hover:text-red-300"
                    aria-label={t('new.removeItem')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-secondary">{t('editor.lineTaxRateHint')}</p>
          </Card>

          {/* Tax mode, discount & rounding */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent">
                <Percent size={16} />
              </span>
              <h2 className="font-semibold text-text-primary">{t('editor.moneyHeading')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoice-tax-mode" className={labelClass}>
                  {t('editor.taxMode')}
                </label>
                <select
                  id="invoice-tax-mode"
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                  className={inputClass}
                >
                  <option value="exclusive">{t('editor.taxModeExclusive')}</option>
                  <option value="inclusive">{t('editor.taxModeInclusive')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="invoice-rounding" className={labelClass}>
                  {t('editor.rounding')}
                </label>
                <select
                  id="invoice-rounding"
                  value={roundingIncrement}
                  onChange={(e) => setRoundingIncrement(Number(e.target.value))}
                  className={inputClass}
                >
                  {ROUNDING_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 0 ? t('editor.roundingNone') : option.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="invoice-discount-type" className={labelClass}>
                  {t('editor.discountType')}
                </label>
                <select
                  id="invoice-discount-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className={inputClass}
                >
                  <option value="percent">{t('editor.discountPercent')}</option>
                  <option value="fixed">{t('editor.discountFixed')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="invoice-discount-value" className={labelClass}>
                  {t('editor.discountValue')}
                </label>
                <input
                  id="invoice-discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent">
                <StickyNote size={16} />
              </span>
              <h2 className="font-semibold text-text-primary">{t('new.notes')}</h2>
            </div>
            <div>
              <label htmlFor="invoice-notes" className={labelClass}>
                {t('new.notes')}
              </label>
              <textarea
                id="invoice-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputClass} min-h-20`}
              />
            </div>
          </Card>

          {/* Live money summary */}
          <Card className="border-accent/40 shadow-glow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1 text-sm text-text-secondary">
                <p>
                  {t('editor.subtotalLabel')}{' '}
                  <span className="text-text-primary">
                    {currency} {money.subtotal.toFixed(2)}
                  </span>
                </p>
                {money.discountAmount > 0 && (
                  <p>
                    {t('editor.discountLabel')}{' '}
                    <span className="text-text-primary">
                      -{currency} {money.discountAmount.toFixed(2)}
                    </span>
                  </p>
                )}
                <p>
                  {t('editor.taxLabel')}{' '}
                  <span className="text-text-primary">
                    {currency} {money.taxAmount.toFixed(2)}
                  </span>
                </p>
                {money.roundingAdjustment !== 0 && (
                  <p>
                    {t('editor.roundingLabel')}{' '}
                    <span className="text-text-primary">
                      {currency} {money.roundingAdjustment.toFixed(2)}
                    </span>
                  </p>
                )}
                <p className="text-xs">{t('editor.effectiveTax', { rate: money.effectiveTaxRate })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-text-secondary">{t('editor.totalLabel')}</p>
                <p className="text-3xl font-bold text-text-primary">
                  {currency} {money.total.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-text-secondary" aria-live="polite" data-testid="autosave-status">
              {autoSaveText}
            </span>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                {t('new.cancel')}
              </Button>
              <Button type="submit" loading={submitting} size="lg">
                {submitLabel}
              </Button>
            </div>
          </div>
        </form>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <TemplateSelector
            value={templateSettings}
            onChange={handleTemplateChange}
            usingGlobalDefault={usingGlobalTemplate}
          />
          {generationEnabled && (
            <FeatureGate
              feature={FEATURES.CUSTOM_BRANDING}
              fallback={<UpgradePrompt message={t('editor.branding.locked')} />}
            >
              <BrandingControls value={templateSettings} onChange={handleTemplateChange} />
              <SignatureSeal value={templateSettings} onChange={handleTemplateChange} sealCode={sealCode} />
            </FeatureGate>
          )}
          <LivePreview
            template={templateSettings}
            currency={currency}
            locale={locale}
            money={{
              subtotal: money.subtotal,
              discountAmount: money.discountAmount,
              taxAmount: money.taxAmount,
              total: money.total,
            }}
            items={items.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0,
            }))}
            invoiceNumber={invoiceNumber || undefined}
            clientName={clients.find((client) => client.id === clientId)?.name}
            dueDate={dueDate}
            notes={notes}
            sealCode={sealCode}
          />
        </aside>
        </div>
      </div>
    </div>
  )
}
