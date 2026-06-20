'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'

function hasAcceptedCookies() {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('cookie_consent='))

  if (!cookie) {
    return false
  }

  return cookie.split('=')[1] === 'accepted'
}

export default function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const update = () => setEnabled(hasAcceptedCookies())
    update()
    window.addEventListener('cookie-consent-updated', update)
    return () => window.removeEventListener('cookie-consent-updated', update)
  }, [])

  if (!enabled) {
    return null
  }

  return <Analytics />
}
