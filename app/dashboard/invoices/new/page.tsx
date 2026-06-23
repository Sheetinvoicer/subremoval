'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FormPageSkeleton } from '@/components/LoadingSkeleton'
import { generateInvoiceNumber } from '@/lib/invoiceNumber'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import CSVUploader from '@/components/CSVUploader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  ArrowLeft,
  Users,
  CalendarDays,
  ListPlus,
  Percent,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'

interface ClientItem {
  id: string
  name: string
  email?: string
}

interface ProjectItem {
  id: string
  name: string
}

interface InvoiceItem {
  description: string
  quantity: number
  price: number
}

const emptyItem: InvoiceItem = { description: '', quantity: 1, price: 0 }

const inputClass =
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
const labelClass = 'block text-sm font-medium mb-1 text-text-secondary'

export default function NewInvoicePage() {
  const t = useTranslations('invoices')
  const router = useRouter()
  const [clients, setClients] = useState<ClientItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([{ ...emptyItem }])
  const [currency, setCurrency] = useState('USD')
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0),
    [items],
  )
  const taxAmount = useMemo(() => subtotal * ((Number(taxRate) || 0) / 100), [subtotal, taxRate])
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount])

  useEffect(() => {
    const loadClients = async () => {
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

      const [{ data, error: clientsError }, { data: projectData, error: projectsError }] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
        supabase
          .from('projects')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ])

      if (clientsError || projectsError) {
        setError(clientsError?.message || projectsError?.message || t('new.errors.loadDependencies'))
      } else {
        setClients(data || [])
        setProjects((projectData as ProjectItem[]) || [])
      }

      setLoading(false)
    }

    loadClients()
  }, [])

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }])
  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const updateItem = (index: number, key: keyof InvoiceItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: key === 'description' ? value : Number(value),
            }
          : item,
      ),
    )
  }

  const validate = () => {
    if (!clientId) return t('new.errors.selectClient')
    if (!dueDate) return t('new.errors.dueDateRequired')
    if (!items.length) return t('new.errors.itemRequired')

    for (const item of items) {
      if (!item.description.trim()) return t('new.errors.itemDescriptionRequired')
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return t('new.errors.itemQuantityInvalid')
      if (!Number.isFinite(item.price) || item.price < 0) return t('new.errors.itemPriceNegative')
    }

    if (subtotal <= 0) return t('new.errors.subtotalInvalid')
    if (Number(taxRate) < 0 || Number(taxRate) > 100) return t('new.errors.taxRateInvalid')

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

    try {
      const invoiceNumber = await generateInvoiceNumber(user.id)
      const normalizedItems = items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        price: Number(item.price),
        total: Number(item.quantity) * Number(item.price),
      }))

      const { data: createdInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          project_id: projectId || null,
          invoice_number: invoiceNumber,
          items: normalizedItems,
          subtotal,
          tax_rate_percentage: Number(taxRate),
          tax_amount: taxAmount,
          total,
          currency,
          due_date: dueDate,
          notes,
          status: 'draft',
        })
        .select('id')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      setSuccess(t('new.successCreated', { number: invoiceNumber }))
      // Show the success animation, then redirect on completion.
      setCreatedInvoiceId(createdInvoice?.id ?? null)
      setSuccessOpen(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('new.errors.createFailed'))
      setSubmitting(false)
    }
  }

  const finishSuccess = () => {
    if (createdInvoiceId) {
      router.push(`/dashboard/invoices/${createdInvoiceId}`)
    } else {
      router.push('/dashboard/invoices')
    }
  }

  if (loading) {
    return <FormPageSkeleton fields={8} />
  }

  const handleCSVData = (data: Record<string, string>[]) => {
    const parsed = data
      .map((row) => ({
        description: row['description'] || row['Description'] || row['name'] || row['Name'] || '',
        quantity: Number(row['quantity'] || row['Quantity'] || row['qty'] || row['Qty'] || 1),
        price: Number(row['price'] || row['Price'] || row['rate'] || row['Rate'] || row['amount'] || row['Amount'] || 0),
      }))
      .filter((item) => item.description.trim() !== '')
    if (parsed.length > 0) {
      setItems(parsed)
    }
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{t('new.newInvoice')}</h1>
          <Link href="/dashboard/invoices" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent">
            <ArrowLeft size={15} />
            {t('new.backToInvoices')}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-button border border-red-500/30 bg-red-500/10 text-red-400 px-4 py-3 text-sm">{error}</div>}
          {success && <div className="rounded-button border border-success/30 bg-success/10 text-success px-4 py-3 text-sm">{success}</div>}

          {/* Client & Project */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent"><Users size={16} /></span>
              <h2 className="font-semibold text-text-primary">{t('new.client')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoice-client" className={labelClass}>{t('new.client')}</label>
                <select id="invoice-client" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                  <option value="">{t('new.selectClientPlaceholder')}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.email ? `(${client.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="invoice-project" className={labelClass}>{t('new.project')}</label>
                <select id="invoice-project" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
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

          {/* Dates & Currency */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent"><CalendarDays size={16} /></span>
              <h2 className="font-semibold text-text-primary">{t('new.dueDate')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoice-due-date" className={labelClass}>{t('new.dueDate')}</label>
                <input id="invoice-due-date" name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
              </div>
              <div>
                <label htmlFor="invoice-currency" className={labelClass}>{t('new.currency')}</label>
                <input id="invoice-currency" name="currency" type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputClass} />
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-button bg-accent/10 p-1.5 text-accent"><ListPlus size={16} /></span>
                <h2 className="font-semibold text-text-primary">{t('new.items')}</h2>
              </div>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
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
                  <label htmlFor={`invoice-item-description-${index}`} className="sr-only">{t('new.itemDescription')}</label>
                  <input id={`invoice-item-description-${index}`} name={`items[${index}][description]`} className={`md:col-span-6 ${inputClass}`} placeholder={t('new.itemDescription')} value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
                  <label htmlFor={`invoice-item-quantity-${index}`} className="sr-only">{t('new.itemQuantity')}</label>
                  <input id={`invoice-item-quantity-${index}`} name={`items[${index}][quantity]`} className={`md:col-span-2 ${inputClass}`} type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                  <label htmlFor={`invoice-item-price-${index}`} className="sr-only">{t('new.itemRate')}</label>
                  <input id={`invoice-item-price-${index}`} name={`items[${index}][price]`} className={`md:col-span-2 ${inputClass}`} type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} />
                  <div className="md:col-span-1 text-sm text-text-secondary">{(item.quantity * item.price).toFixed(2)}</div>
                  <button type="button" onClick={() => removeItem(index)} className="md:col-span-1 inline-flex items-center justify-center text-red-400 hover:text-red-300" aria-label={t('new.removeItem')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Tax & Notes */}
          <Card hoverGlow={false}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-button bg-accent/10 p-1.5 text-accent"><Percent size={16} /></span>
              <h2 className="font-semibold text-text-primary">{t('new.taxRate')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoice-tax-rate" className={labelClass}>{t('new.taxRate')}</label>
                <input id="invoice-tax-rate" name="taxRate" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className={inputClass} />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="invoice-notes" className={labelClass}>{t('new.notes')}</label>
              <textarea id="invoice-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} min-h-20`} />
            </div>
          </Card>

          {/* Live total summary */}
          <Card className="border-accent/40 shadow-glow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1 text-sm text-text-secondary">
                <p>{t('new.subtotalLabel')} <span className="text-text-primary">{currency} {subtotal.toFixed(2)}</span></p>
                <p>{t('new.taxLabel')} <span className="text-text-primary">{currency} {taxAmount.toFixed(2)}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-text-secondary">{t('new.totalLabel')}</p>
                <p className="text-3xl font-bold text-text-primary">{currency} {total.toFixed(2)}</p>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              {t('new.cancel')}
            </Button>
            <Button type="submit" loading={submitting} size="lg">
              {submitting ? t('new.creating') : t('new.createInvoice')}
            </Button>
          </div>
        </form>
      </div>

      {/* Success animation overlay */}
      <AnimatePresence>
        {successOpen && (
          <motion.div
            key="success-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center gap-4 rounded-card border border-border bg-card/90 px-10 py-8 shadow-glow"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}
                onAnimationComplete={() => {
                  // Hold the checkmark briefly, then redirect.
                  setTimeout(finishSuccess, 900)
                }}
              >
                <Check size={36} strokeWidth={3} />
              </motion.div>
              <p className="text-sm font-medium text-text-primary">{t('new.successAnimation')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
