"use client";


import { useState } from 'react'

interface Plan {
  name: string
  price: number
  popular?: boolean
  priceId?: string
  features: string[]
}

export default function PricingPage() {
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const handleSubscribe = async (planName: string, priceId?: string) => {
    if (planName === 'Free') {
      window.location.href = '/signup'
      return
    }
    setLoading(planName)
    try {
      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, successUrl: window.location.origin + '/dashboard', cancelUrl: window.location.origin + '/pricing' })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Error: ' + data.error)
    } catch (err) { alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error')) }
    finally { setLoading(null) }
  }

  const plans: Plan[] = [
    { name: 'Free', price: 0, features: ['3 invoices/month', 'CSV upload', 'Single PDF'] },
    { name: 'Pro', price: 9, popular: true, priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID, features: ['Unlimited invoices', 'CSV bulk import', 'Multi-PDF', 'Recurring', 'Stripe payments'] },
    { name: 'Business', price: 29, priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID, features: ['Everything in Pro', 'Team members', 'API access', 'Priority support'] }
  ]

  const getPrice = (plan: Plan) => billing === 'monthly' ? plan.price : plan.price * 10

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-20 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Simple Pricing</h1>
        <p className="text-gray-600 dark:text-gray-400">Start free, upgrade when you need more</p>
        <div className="inline-flex gap-2 mt-4">
          <button onClick={() => setBilling('monthly')} className={`px-4 py-1 rounded ${billing === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Monthly</button>
          <button onClick={() => setBilling('yearly')} className={`px-4 py-1 rounded ${billing === 'yearly' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Yearly <span className="text-xs text-green-600">Save 17%</span></button>
        </div>
      </div>
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.name} className={`bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow relative ${plan.popular ? 'border-2 border-blue-500' : ''}`}>
            {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-3 py-1 rounded-full">MOST POPULAR</div>}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h2>
            <div className="text-3xl font-bold mt-2">{plan.price === 0 ? 'Free' : `$${getPrice(plan)}`}</div>
            {plan.price > 0 && <div className="text-sm text-gray-500">/{billing === 'monthly' ? 'month' : 'year'}</div>}
            <ul className="mt-4 space-y-2 text-sm text-left">
              {plan.features.map((f, i) => <li key={i}>✓ {f}</li>)}
            </ul>
            <button onClick={() => plan.price === 0 ? window.location.href = '/signup' : handleSubscribe(plan.name, plan.priceId)} disabled={loading === plan.name} className="mt-6 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading === plan.name ? 'Processing...' : plan.price === 0 ? 'Get Started' : 'Subscribe Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
