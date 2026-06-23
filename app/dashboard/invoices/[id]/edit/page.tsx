'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { FormPageSkeleton } from '@/components/LoadingSkeleton';
import toast, { Toaster } from 'react-hot-toast';

interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  project_id?: string | null
  total: number
  subtotal?: number
  tax_amount?: number
  tax_rate_percentage?: number
  currency: string
  status: string
  due_date: string
  items?: { description: string; quantity: number; price: number; total?: number }[]
  notes?: string
}

interface ClientItem {
  id: string
  name: string
  email?: string
}

interface ProjectItem {
  id: string
  name: string
}

export default function EditInvoicePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [clients, setClients] = useState<ClientItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const subtotal = useMemo(() => {
    if (!invoice?.items?.length) return 0
    return invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0)
  }, [invoice])

  const taxAmount = useMemo(() => subtotal * ((Number(invoice?.tax_rate_percentage || 0)) / 100), [subtotal, invoice?.tax_rate_percentage])
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount])

  useEffect(() => {
    async function loadInvoice() {
      const supabase = createClient()
      if (!supabase) {
        setError("Failed to initialize Supabase client")
        setLoading(false)
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setError('Please login to edit invoices.')
        setLoading(false)
        return
      }

      const { data, error: queryError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', id)
        .single()

      const [{ data: clientsData }, { data: projectsData }] = await Promise.all([
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

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }

      setInvoice({
        ...data,
        items: Array.isArray(data?.items) && data.items.length ? data.items : [{ description: '', quantity: 1, price: 0 }],
      })
      setClients(clientsData || [])
      setProjects((projectsData as ProjectItem[]) || [])
      setLoading(false)
    }

    if (id) {
      loadInvoice()
    }
  }, [id])

  const updateItem = (index: number, key: 'description' | 'quantity' | 'price', value: string) => {
    if (!invoice) return
    const nextItems = (invoice.items || []).map((item, i) =>
      i === index
        ? {
            ...item,
            [key]: key === 'description' ? value : Number(value),
          }
        : item,
    )
    setInvoice({ ...invoice, items: nextItems })
  }

  const addItem = () => {
    if (!invoice) return
    setInvoice({ ...invoice, items: [...(invoice.items || []), { description: '', quantity: 1, price: 0 }] })
  }

  const removeItem = (index: number) => {
    if (!invoice) return
    const next = (invoice.items || []).filter((_, i) => i !== index)
    setInvoice({ ...invoice, items: next.length ? next : [{ description: '', quantity: 1, price: 0 }] })
  }

  const validate = () => {
    if (!invoice) return 'Invoice not loaded.'
    if (!invoice.client_id) return 'Client is required.'
    if (!invoice.due_date) return 'Due date is required.'
    if (!invoice.items?.length) return 'At least one item is required.'
    if ((invoice.tax_rate_percentage || 0) < 0 || (invoice.tax_rate_percentage || 0) > 100) return 'Tax rate must be between 0 and 100.'

    for (const item of invoice.items) {
      if (!item.description?.trim()) return 'Each item must include description.'
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return 'Quantity must be greater than 0.'
      if (!Number.isFinite(item.price) || item.price < 0) return 'Price cannot be negative.'
    }

    if (subtotal <= 0) return 'Subtotal must be greater than 0.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!invoice) return

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    if (!supabase) {
      setError("Failed to initialize Supabase client")
      setSaving(false)
      return
    }

    const normalizedItems = (invoice.items || []).map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      price: Number(item.price),
      total: Number(item.quantity) * Number(item.price),
    }))

    const { error: queryError } = await supabase
      .from('invoices')
      .update({
        client_id: invoice.client_id,
        project_id: invoice.project_id || null,
        items: normalizedItems,
        subtotal,
        tax_rate_percentage: Number(invoice.tax_rate_percentage || 0),
        tax_amount: taxAmount,
        total,
        currency: invoice.currency,
        due_date: invoice.due_date,
        notes: invoice.notes,
      })
      .eq('id', invoice.id)

    if (queryError) {
      setError(queryError.message)
      toast.error('Failed to update invoice')
      setSaving(false)
      return
    }

    toast.success('Invoice updated successfully!')
    router.push(`/dashboard/invoices/${invoice.id}`)
    setSaving(false)
  }

  if (loading) {
    return <FormPageSkeleton fields={8} />
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-600 dark:text-yellow-400">Invoice not found</p>
          <Link href="/dashboard/invoices">
            <a className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Back to Invoices
            </a>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Toaster position="top-right" />
      
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/invoices" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Invoice #{invoice.invoice_number}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
        {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client</label>
            <select value={invoice.client_id || ''} onChange={(e) => setInvoice({ ...invoice, client_id: e.target.value })} className="w-full border rounded px-3 py-2">
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}{client.email ? ` (${client.email})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select value={invoice.project_id || ''} onChange={(e) => setInvoice({ ...invoice, project_id: e.target.value || null })} className="w-full border rounded px-3 py-2">
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due date</label>
            <input type="date" value={invoice.due_date || ''} onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <input type="text" maxLength={3} value={invoice.currency || 'USD'} onChange={(e) => setInvoice({ ...invoice, currency: e.target.value.toUpperCase() })} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Line items</h2>
            <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">+ Add item</button>
          </div>
          {(invoice.items || []).map((item, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <input className="md:col-span-6 border rounded px-3 py-2" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description" />
              <input className="md:col-span-2 border rounded px-3 py-2" type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
              <input className="md:col-span-2 border rounded px-3 py-2" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} />
              <div className="md:col-span-1 text-sm">{(Number(item.quantity) * Number(item.price)).toFixed(2)}</div>
              <button type="button" onClick={() => removeItem(index)} className="md:col-span-1 text-red-600 text-sm">Remove</button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tax rate (%)</label>
            <input type="number" min="0" max="100" step="0.01" value={invoice.tax_rate_percentage || 0} onChange={(e) => setInvoice({ ...invoice, tax_rate_percentage: Number(e.target.value) })} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-2 text-sm space-y-1 text-gray-700">
            <p>Subtotal: {subtotal.toFixed(2)}</p>
            <p>Tax: {taxAmount.toFixed(2)}</p>
            <p className="font-semibold">Total: {total.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea value={invoice.notes || ''} onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })} className="w-full border rounded px-3 py-2 min-h-20" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  )
}