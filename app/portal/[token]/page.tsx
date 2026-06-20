"use client";


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface PortalPageProps {
  params: { token: string }
}

interface InvoiceClient {
  name?: string
  email?: string
}

interface Invoice {
  id: string
  invoice_number: string
  total: number
  status: string
  currency?: string
  due_date?: string | null
  clients?: InvoiceClient
}

export default function PortalPage({ params }: PortalPageProps) {
  const [token, setToken] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // No await needed - params is already resolved
    setToken(params.token)
  }, [params])

  useEffect(() => {
    if (!supabase) {
      setError('Failed to initialize Supabase client')
      setLoading(false)
      return
    }

    const client = supabase

    async function loadInvoice() {
      if (!token) return
      
      const { data, error } = await client
        .from('invoices')
        .select('*, clients(*)')
        .eq('magic_link_token', token)
        .single()
      
      if (error || !data) {
        setError('Invalid or expired link')
      } else {
        setInvoice(data)
      }
      setLoading(false)
    }
    
    loadInvoice()
  }, [token])

  const handlePayment = async () => {
    if (!invoice) {
      setError('Invalid invoice')
      return
    }

    setPaying(true)
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.total,
          clientName: invoice.clients?.name,
          clientEmail: invoice.clients?.email,
          successUrl: `${window.location.origin}/dashboard/invoices/${invoice.id}`,
          cancelUrl: window.location.href
        }),
      })
      
      const { url } = await response.json()
      if (url) {
        window.location.href = url
      } else {
        setError('Failed to create payment session')
      }
    } catch (err) {
      setError('Payment error occurred')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-600">{error}</p>
        <Link href="/" className="mt-4 text-blue-600 hover:underline">Go to Home</Link>
      </div>
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">Invoice #{invoice.invoice_number}</h1>
        
        <div className="space-y-4 mb-8">
          <div className="border-b pb-4">
            <p className="text-gray-500">Amount Due</p>
            <p className="text-3xl font-bold text-gray-900">
              {invoice.currency || 'USD'} {invoice.total?.toFixed(2)}
            </p>
          </div>
          
          <div>
            <p className="text-gray-500">Status</p>
            <p className={`font-semibold ${
              invoice.status === 'paid' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {invoice.status || 'Pending'}
            </p>
          </div>
          
          <div>
            <p className="text-gray-500">Due Date</p>
            <p>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Not set'}</p>
          </div>
        </div>
        
        {invoice.status !== 'paid' && (
          <button
            onClick={handlePayment}
            disabled={paying}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {paying ? 'Processing...' : 'Pay Now'}
          </button>
        )}
        
        {invoice.status === 'paid' && (
          <div className="text-center text-green-600 font-semibold">
            ✓ This invoice has been paid
          </div>
        )}
      </div>
    </div>
  )
}