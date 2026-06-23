'use client';

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import Footer from '@/components/Footer'
import SearchBar from '@/components/SearchBar'
import { Toaster } from 'react-hot-toast'
import { useLocale } from 'next-intl'

// Lazy-load non-critical widgets so they don't block dashboard page transitions
const AIAssistant = dynamic(() => import('@/components/AIAssistant'), { ssr: false })
const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false })

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
        <div className="flex flex-1 flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-auto">
            <div className="max-w-7xl mx-auto">
              <div className={`mb-4 flex ${isRtl ? 'justify-start' : 'justify-end'}`}>
                <SearchBar />
              </div>
              <Toaster
                position={isRtl ? 'bottom-left' : 'bottom-right'}
                toastOptions={{
                  style: {
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    border: '1px solid #2A2A2A',
                    borderRadius: '12px',
                  },
                  success: { iconTheme: { primary: '#10B981', secondary: '#1A1A1A' } },
                  error: { iconTheme: { primary: '#EF4444', secondary: '#1A1A1A' } },
                }}
              />
              {children}
            </div>
            <AIAssistant />
            <OnboardingTour />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
