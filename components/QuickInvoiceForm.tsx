'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import Button from './Button'
import FormInput from './FormInput'
import Modal from './Modal'
import { generateInvoiceNumber } from '@/lib/invoiceNumber'

// Exchange rates (1 USD = X foreign currency)
const EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.36,
  AUD: 1.51,
  JPY: 148.5,
  CNY: 7.25,
  INR: 83.5,
  BRL: 5.15,
  AED: 3.67,
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'AED', symbol: 'د.إ', name: 'Dirham' },
]

export default function QuickInvoiceForm({ clients, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState('USD')
  const [formData, setFormData] = useState({
    client_id: '',
    amount: '',
    due_date: '',
    notes: ''
  })
  const supabase = createClient()

  const getConvertedAmounts = (amount, currencyCode) => {
    const amountInSelectedCurrency = parseFloat(amount) || 0
    const rate = EXCHANGE_RATES[currencyCode] || 1
    const amountInUSD = amountInSelectedCurrency / rate
    return {
      selectedCurrencyAmount: amountInSelectedCurrency,
      usdAmount: amountInUSD,
      rate: rate
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      toast.error('Please login first')
      setLoading(false)
      return
    }
    
    const invoiceNumber = await generateInvoiceNumber(user.id)
    const amount = parseFloat(formData.amount) || 0
    const { selectedCurrencyAmount, usdAmount, rate } = getConvertedAmounts(amount, currency)
    
    const { error } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: formData.client_id,
        invoice_number: invoiceNumber,
        subtotal: selectedCurrencyAmount,
        total: selectedCurrencyAmount,
        currency: currency,
        exchange_rate: rate,
        base_currency_total: usdAmount,
        due_date: formData.due_date || null,
        notes: formData.notes,
        status: 'draft'
      })
    
    setLoading(false)
    
    if (error) {
      toast.error('Error creating invoice: ' + error.message)
    } else {
      toast.success(`Invoice ${invoiceNumber} created in ${currency}!`)
      setIsOpen(false)
      setFormData({ client_id: '', amount: '', due_date: '', notes: '' })
      setCurrency('USD')
      onSuccess()
    }
  }

  const selectedCurrency = CURRENCIES.find(c => c.code === currency)

  return (
    <>
      <Toaster position="top-right" />
      <Button onClick={() => setIsOpen(true)} variant="success" size="sm">
        ⚡ Quick Invoice
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Quick Create Invoice"
        onConfirm={handleSubmit}
        confirmText={loading ? "Creating..." : "Create Invoice"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg text-gray-900"
              required
            >
              <option value="">Select client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} - {client.email}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-gray-900"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <FormInput
              label={`Amount (${selectedCurrency?.symbol || '$'})`}
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              placeholder="0.00"
            />
          </div>
          
          <FormInput
            label="Due Date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
          
          <FormInput
            label="Notes (Optional)"
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Invoice notes..."
          />
          
          {formData.amount && currency !== 'USD' && (
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
              ≈ ${(parseFloat(formData.amount) / EXCHANGE_RATES[currency]).toFixed(2)} USD
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            💰 Invoice number will be auto-generated (e.g., INV-000001)
          </div>
        </div>
      </Modal>
    </>
  )
}
