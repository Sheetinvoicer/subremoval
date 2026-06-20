"use client";


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/public'

interface PublicPaymentPageProps {
  params: { id: string }
}

interface ClientInfo {
  name?: string
  email?: string
}

interface Invoice {
  id: string
  invoice_number: string
  total: number
  status: string
  created_at: string
  clients?: ClientInfo
}

export default function PublicPaymentPage({ params }: PublicPaymentPageProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingPayment, setCreatingPayment] = useState(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const status = searchParams.get('status')

    if (status === 'cancel') {
      setError('Payment was canceled. You can try again.')
    }
  }, [])

  useEffect(() => {
    async function loadInvoice() {
      try {
        const invoiceId = params.id
        
        const { data, error } = await supabase
          .from('invoices')
          .select('*, clients(*)')
          .eq('id', invoiceId)
          .single()
        
        if (error) {
          setError('Invoice not found')
          setLoading(false)
          return
        }
        
        if (data) {
          setInvoice(data)
        } else {
          setError('Invoice not found')
        }
      } catch (err) {
        setError('Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }
    
    loadInvoice()
  }, [params])

  const handleCreatePayment = async () => {
    if (!invoice) {
      setError('Invoice not found')
      return
    }

    setCreatingPayment(true)
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
          returnUrl: window.location.href,
        }),
      })
      
      const result = await response.json()
      if (!response.ok) {
        setError(result?.error || 'Could not create payment link')
        return
      }

      if (result.url) {
        window.location.href = result.url
      } else {
        setError('Could not create payment link')
      }
    } catch (err) {
      setError('Failed to create payment')
    } finally {
      setCreatingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">{error || 'Invoice not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-blue-600 px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">Invoice</h1>
            <p className="text-blue-100 mt-1">#{invoice.invoice_number}</p>
          </div>
          
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Invoice Details</h2>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-bold text-gray-900 dark:text-white">${invoice.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    invoice.status === 'paid' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="text-gray-900 dark:text-white">{new Date(invoice.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Client Information</h2>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-gray-800 dark:text-gray-200"><strong>Name:</strong> {invoice.clients?.name}</p>
                <p className="text-gray-800 dark:text-gray-200"><strong>Email:</strong> {invoice.clients?.email}</p>
              </div>
            </div>

            {invoice.status !== 'paid' && (
              <div className="text-center">
                <button
                  onClick={handleCreatePayment}
                  disabled={creatingPayment}
                  className="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {creatingPayment ? 'Processing...' : 'Pay Now'}
                </button>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Secure payment powered by Stripe
                </p>
              </div>
            )}

            {invoice.status === 'paid' && (
              <div className="text-center bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
                <p className="text-green-700 dark:text-green-300 font-semibold">This invoice has been paid</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
