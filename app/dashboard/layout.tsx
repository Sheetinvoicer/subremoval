'use client';

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import Footer from '@/components/Footer'
import SearchBar from '@/components/SearchBar'
import { Toaster } from 'react-hot-toast'
import { useLocale } from 'next-intl'
import { DashboardChromeSkeleton } from '@/components/LoadingSkeleton'

// Lazy-load non-critical widgets so they don't block dashboard page transitions
const AIChatWidget = dynamic(() => import('@/components/dashboard/AIChatWidget'), { ssr: false })
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

  // Render a structural chrome skeleton (instead of a blank screen) until the
  // client layout mounts. This keeps the page from flashing empty and then
  // "popping" the whole dashboard into view, which is one of the causes of the
  // perceived content jump on initial load.
  if (!mounted) return <DashboardChromeSkeleton />

  return (
    <div className="relative flex flex-col min-h-screen">
      {/* Ambient glass-morphism backdrop: soft accent glows behind the chrome. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-accent-secondary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </div>
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
            <AIChatWidget />
            <OnboardingTour />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
