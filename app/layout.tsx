import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import ConsentAwareAnalytics from '@/components/ConsentAwareAnalytics'
import CookieConsentBanner from '@/components/CookieConsentBanner'
import PageTransition from '@/components/PageTransition'
import ChunkErrorHandler from '@/components/ChunkErrorHandler'
import { Toaster } from 'react-hot-toast'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { rtlLocales } from '@/i18n/routing'

export const metadata = {
  title: 'SheetInvoicer - AI-Powered Invoicing Platform',
  description: 'Professional invoicing made simple with AI automation, 10+ currencies',
  keywords: 'invoicing, AI, payments, global business, automation, SaaS',
  authors: [{ name: 'SheetInvoicer' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'SheetInvoicer - AI-Powered Invoicing',
    description: 'Professional invoicing made simple',
    url: 'https://www.sheetinvoicer.com',
    siteName: 'SheetInvoicer',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#8b5cf6',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const direction = rtlLocales.has(locale) ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-text-primary">
        <ChunkErrorHandler />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <PageTransition>{children}</PageTransition>
            <Toaster
              position="bottom-right"
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
            <CookieConsentBanner />
            <ConsentAwareAnalytics />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
