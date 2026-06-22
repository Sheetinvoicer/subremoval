'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateInvoiceNumber } from '@/lib/invoiceNumber'
import { useTranslations } from 'next-intl'

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
      if (createdInvoice?.id) {
        router.push(`/dashboard/invoices/${createdInvoice.id}`)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('new.errors.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6">{t('new.loading')}</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('new.newInvoice')}</h1>
        <Link href="/dashboard/invoices" className="text-sm text-blue-600 hover:underline">
          {t('new.backToInvoices')}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
        {success && <div className="rounded-md bg-green-50 text-green-700 px-4 py-3 text-sm">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="invoice-client" className="block text-sm font-medium mb-1">{t('new.client')}</label>
            <select id="invoice-client" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">{t('new.selectClientPlaceholder')}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.email ? `(${client.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invoice-project" className="block text-sm font-medium mb-1">{t('new.project')}</label>
            <select id="invoice-project" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">{t('new.noProject')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invoice-due-date" className="block text-sm font-medium mb-1">{t('new.dueDate')}</label>
            <input id="invoice-due-date" name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label htmlFor="invoice-currency" className="block text-sm font-medium mb-1">{t('new.currency')}</label>
            <input id="invoice-currency" name="currency" type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold">{t('new.items')}</h2>
            <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">
              {t('new.addItem')}
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <label htmlFor={`invoice-item-description-${index}`} className="sr-only">{t('new.itemDescription')}</label>
                <input id={`invoice-item-description-${index}`} name={`items[${index}][description]`} className="md:col-span-6 border rounded px-3 py-2" placeholder={t('new.itemDescription')} value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
                <label htmlFor={`invoice-item-quantity-${index}`} className="sr-only">{t('new.itemQuantity')}</label>
                <input id={`invoice-item-quantity-${index}`} name={`items[${index}][quantity]`} className="md:col-span-2 border rounded px-3 py-2" type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                <label htmlFor={`invoice-item-price-${index}`} className="sr-only">{t('new.itemRate')}</label>
                <input id={`invoice-item-price-${index}`} name={`items[${index}][price]`} className="md:col-span-2 border rounded px-3 py-2" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} />
                <div className="md:col-span-1 text-sm text-gray-700">{(item.quantity * item.price).toFixed(2)}</div>
                <button type="button" onClick={() => removeItem(index)} className="md:col-span-1 text-sm text-red-600 hover:underline">
                  {t('new.removeItem')}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="invoice-tax-rate" className="block text-sm font-medium mb-1">{t('new.taxRate')}</label>
            <input id="invoice-tax-rate" name="taxRate" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-2 text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <p>{t('new.subtotalLabel')} {subtotal.toFixed(2)}</p>
            <p>{t('new.taxLabel')} {taxAmount.toFixed(2)}</p>
            <p className="font-semibold">{t('new.totalLabel')} {total.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <label htmlFor="invoice-notes" className="block text-sm font-medium mb-1">{t('new.notes')}</label>
          <textarea id="invoice-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-3 py-2 min-h-20" />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
            {t('new.cancel')}
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {submitting ? t('new.creating') : t('new.createInvoice')}
          </button>
        </div>
      </form>
    </div>
  )
}