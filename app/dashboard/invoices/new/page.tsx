'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateInvoiceNumber } from '@/lib/invoiceNumber'

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
        setError('Failed to initialize Supabase client.')
        setLoading(false)
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setError('Please log in to create invoices.')
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
        setError(clientsError?.message || projectsError?.message || 'Failed to load invoice dependencies')
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
    if (!clientId) return 'Please select a client.'
    if (!dueDate) return 'Due date is required.'
    if (!items.length) return 'At least one invoice item is required.'

    for (const item of items) {
      if (!item.description.trim()) return 'Each line item must have a description.'
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return 'Item quantity must be greater than 0.'
      if (!Number.isFinite(item.price) || item.price < 0) return 'Item price cannot be negative.'
    }

    if (subtotal <= 0) return 'Invoice subtotal must be greater than 0.'
    if (Number(taxRate) < 0 || Number(taxRate) > 100) return 'Tax rate must be between 0 and 100.'

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
      setError('Failed to initialize Supabase client.')
      return
    }

    setSubmitting(true)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setSubmitting(false)
      setError('You must be logged in to create invoices.')
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

      setSuccess(`Invoice ${invoiceNumber} created successfully.`)
      if (createdInvoice?.id) {
        router.push(`/dashboard/invoices/${createdInvoice.id}`)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Invoice</h1>
        <Link href="/dashboard/invoices" className="text-sm text-blue-600 hover:underline">
          Back to invoices
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
        {success && <div className="rounded-md bg-green-50 text-green-700 px-4 py-3 text-sm">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="invoice-client" className="block text-sm font-medium mb-1">Client</label>
            <select id="invoice-client" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.email ? `(${client.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invoice-project" className="block text-sm font-medium mb-1">Project</label>
            <select id="invoice-project" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invoice-due-date" className="block text-sm font-medium mb-1">Due date</label>
            <input id="invoice-due-date" name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label htmlFor="invoice-currency" className="block text-sm font-medium mb-1">Currency</label>
            <input id="invoice-currency" name="currency" type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold">Line items</h2>
            <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">
              + Add item
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <label htmlFor={`invoice-item-description-${index}`} className="sr-only">Description</label>
                <input id={`invoice-item-description-${index}`} name={`items[${index}][description]`} className="md:col-span-6 border rounded px-3 py-2" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
                <label htmlFor={`invoice-item-quantity-${index}`} className="sr-only">Quantity</label>
                <input id={`invoice-item-quantity-${index}`} name={`items[${index}][quantity]`} className="md:col-span-2 border rounded px-3 py-2" type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                <label htmlFor={`invoice-item-price-${index}`} className="sr-only">Price</label>
                <input id={`invoice-item-price-${index}`} name={`items[${index}][price]`} className="md:col-span-2 border rounded px-3 py-2" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} />
                <div className="md:col-span-1 text-sm text-gray-700">{(item.quantity * item.price).toFixed(2)}</div>
                <button type="button" onClick={() => removeItem(index)} className="md:col-span-1 text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="invoice-tax-rate" className="block text-sm font-medium mb-1">Tax rate (%)</label>
            <input id="invoice-tax-rate" name="taxRate" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-2 text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <p>Subtotal: {subtotal.toFixed(2)}</p>
            <p>Tax: {taxAmount.toFixed(2)}</p>
            <p className="font-semibold">Total: {total.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <label htmlFor="invoice-notes" className="block text-sm font-medium mb-1">Notes</label>
          <textarea id="invoice-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-3 py-2 min-h-20" />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}