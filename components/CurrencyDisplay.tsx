'use client'

import { useEffect, useMemo, useState } from 'react'
import { convertAmount, formatCurrencyAmount, getRatesWithDailyCache } from '@/lib/currency'

type CurrencyDisplayProps = {
  amount: number
  sourceCurrency?: string
  displayCurrency?: string
  className?: string
}

export default function CurrencyDisplay({
  amount,
  sourceCurrency = 'USD',
  displayCurrency = 'USD',
  className,
}: CurrencyDisplayProps) {
  const [rates, setRates] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let active = true
    getRatesWithDailyCache()
      .then((loadedRates) => {
        if (active) {
          setRates(loadedRates)
        }
      })
      .catch(() => {
        if (active) {
          setRates(null)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const convertedAmount = useMemo(() => {
    if (!rates) {
      return convertAmount(amount, sourceCurrency, displayCurrency)
    }
    return convertAmount(amount, sourceCurrency, displayCurrency, rates as any)
  }, [amount, sourceCurrency, displayCurrency, rates])

  return <span className={className}>{formatCurrencyAmount(convertedAmount, displayCurrency)}</span>
}
