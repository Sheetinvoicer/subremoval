'use client';
"use client";
"use client";


import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      // Verify subscription
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Verifying your subscription...</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">🎉</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Subscription Successful!
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Thank you for subscribing. Your account has been upgraded.
      </p>
      <Link
        href="/dashboard"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
      >
        Go to Dashboard
      </Link>
    </>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <Suspense fallback={
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  )
}
