'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export type CookieConsent = 'accepted' | 'rejected'

const COOKIE_NAME = 'cookie_consent'
const STORAGE_NAME = 'cookieConsent'

function readConsent(): CookieConsent | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))

  if (cookie) {
    const value = cookie.split('=')[1]
    if (value === 'accepted' || value === 'rejected') {
      return value
    }
  }

  const stored = localStorage.getItem(STORAGE_NAME)
  if (stored === 'accepted' || stored === 'rejected') {
    return stored
  }

  return null
}

function saveConsent(value: CookieConsent) {
  localStorage.setItem(STORAGE_NAME, value)
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  window.dispatchEvent(new Event('cookie-consent-updated'))
}

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent | null>(null)

  useEffect(() => {
    setConsent(readConsent())
  }, [])

  const handleConsent = (value: CookieConsent) => {
    saveConsent(value)
    setConsent(value)
  }

  if (consent) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:max-w-xl">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cookie Preferences</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          We use essential cookies to keep your account secure and optional analytics cookies to improve
          SubRemoval. You can accept or reject optional cookies at any time in settings.
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Read more in our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> and{' '}
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => handleConsent('accepted')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => handleConsent('rejected')}
            className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-medium"
          >
            Reject optional
          </button>
        </div>
      </div>
    </div>
  )
}
