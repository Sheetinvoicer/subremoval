'use client'

import { useState } from 'react'
import { Tag, X } from 'lucide-react'

export default function DiscountInput({ subtotal, userId, onDiscountApplied }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [appliedDiscount, setAppliedDiscount] = useState(null)
  const [error, setError] = useState(null)

  const applyDiscount = async () => {
    if (!code.trim()) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, userId: userId, subtotal: subtotal }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setAppliedDiscount(data.discount)
        setError(null)
        onDiscountApplied?.(data)
        setCode('')
      } else {
        setError(data.error)
        setAppliedDiscount(null)
        onDiscountApplied?.(null)
      }
    } catch (err) {
      setError('Failed to apply discount')
      setAppliedDiscount(null)
    } finally {
      setLoading(false)
    }
  }

  const removeDiscount = () => {
    setAppliedDiscount(null)
    onDiscountApplied?.(null)
    setError(null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Discount Code</label>
      
      {!appliedDiscount ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter discount code (WELCOME10, SAVE20, LAUNCH25)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
          />
          <button
            onClick={applyDiscount}
            disabled={loading || !code.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Applying...' : 'Apply'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-600" />
            <div>
              <span className="font-medium text-green-800">{appliedDiscount.code}</span>
              <span className="text-sm text-green-600 ml-2">
                {appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}% off` : `$${appliedDiscount.value} off`}
              </span>
            </div>
          </div>
          <button onClick={removeDiscount} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
