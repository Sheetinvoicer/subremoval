'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function TaxRateSelector({ amount, clientCountry, clientState, onTaxChange }) {
  const [loading, setLoading] = useState(false)
  const [calculatedTax, setCalculatedTax] = useState({ rate: 0, amount: 0, total: 0 })

  useEffect(() => {
    if (amount > 0 && clientCountry) {
      calculateTax()
    }
  }, [amount, clientCountry, clientState])

  const calculateTax = async () => {
    if (!amount || amount <= 0) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/stripe/calculate-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          country: clientCountry || 'US',
          state: clientState,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setCalculatedTax({
          rate: data.taxRate?.rate || 0,
          amount: parseFloat(data.taxAmount),
          total: parseFloat(data.totalAmount),
        })
        if (onTaxChange) {
          onTaxChange(data.taxAmount, data.totalAmount, data.taxRate)
        }
      }
    } catch (error) {
      console.error('Tax calculation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Tax
      </label>
      
      {loading ? (
        <div className="text-sm text-gray-500">Calculating tax...</div>
      ) : (
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${parseFloat(amount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax ({calculatedTax.rate}%):</span>
            <span>${calculatedTax.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
            <span>Total:</span>
            <span>${calculatedTax.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
