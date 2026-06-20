"use client";


import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import Footer from '@/components/Footer'

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <nav className="flex flex-wrap justify-between items-center p-4 md:p-6 max-w-7xl mx-auto">
          <div className="text-xl md:text-2xl font-bold text-blue-600 mb-2 md:mb-0">SheetInvoicer</div>
          <div className="flex gap-3">
            {user ? (
              <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm md:text-base hover:bg-blue-700">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm md:text-base">
                  Login
                </Link>
                <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm md:text-base hover:bg-blue-700">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        <section className="px-4 md:px-6 py-12 md:py-20 text-center max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">
            Turn Spreadsheets into Invoices
            <span className="block text-blue-600 mt-2 text-2xl sm:text-3xl md:text-4xl">in 60 Seconds</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 md:mb-10 px-2">
            Upload your CSV, map columns, and send professional PDF invoices to all your clients instantly.
          </p>
          <Link 
            href="/signup" 
            className="inline-block bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg text-base md:text-lg font-medium hover:bg-blue-700 shadow-lg"
          >
            Start Free Trial →
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
