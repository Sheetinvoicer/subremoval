'use client';

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Footer from '@/components/Footer'
import SearchBar from '@/components/SearchBar'
import AIAssistant from '@/components/AIAssistant'
import { Toaster } from 'react-hot-toast'
import { useLocale } from 'next-intl'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = useLocale()
  const isRtl = locale === 'ar'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 pt-20 md:p-6 lg:p-8 overflow-x-auto">
          <div className="max-w-7xl mx-auto">
            <div className={`mb-4 flex ${isRtl ? 'justify-start' : 'justify-end'}`}>
              <SearchBar />
            </div>
            <Toaster position={isRtl ? 'top-left' : 'top-right'} />
            {children}
          </div>
          <AIAssistant />
        </main>
      </div>
      <Footer />
    </div>
  )
}
