'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.78 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.36 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.51 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 148.50 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rate: 7.25 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 83.50 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rate: 5.15 },
  { code: 'AED', symbol: 'د.إ', name: 'Dirham', rate: 3.67 },
]

export default function CurrencySelector({ value, onChange, amount, showConverted = true }) {
  const [convertedAmount, setConvertedAmount] = useState(null)
  const selectedCurrency = CURRENCIES.find(c => c.code === value) || CURRENCIES[0]

  useEffect(() => {
    if (amount && value && value !== 'USD') {
      const usdAmount = amount / selectedCurrency.rate
      setConvertedAmount(usdAmount)
    } else {
      setConvertedAmount(null)
    }
  }, [amount, value, selectedCurrency.rate])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Currency
      </label>
      <select
        value={value || 'USD'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
          text-gray-900 dark:text-white bg-white dark:bg-gray-700"
      >
        {CURRENCIES.map(currency => (
          <option key={currency.code} value={currency.code}>
            {currency.symbol} {currency.code} - {currency.name}
          </option>
        ))}
      </select>
      
      {showConverted && convertedAmount && (
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          ≈ ${convertedAmount.toFixed(2)} USD
        </div>
      )}
    </div>
  )
}
