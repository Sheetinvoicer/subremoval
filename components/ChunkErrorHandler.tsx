'use client'

import { useEffect } from 'react'

/**
 * Detects ChunkLoadError (and related dynamic import failures) that typically
 * occur right after a new deployment, when the browser still references
 * old chunk filenames that no longer exist on the server. When such an error
 * is detected, the page is reloaded once to fetch the latest assets.
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    const RELOAD_FLAG = 'chunk-reload-attempted'

    const isChunkLoadError = (message?: string) => {
      if (!message) return false
      return (
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Loading CSS chunk') ||
        /Failed to fetch dynamically imported module/i.test(message)
      )
    }

    const reloadOnce = () => {
      // Avoid infinite reload loops if the error persists for another reason.
      if (sessionStorage.getItem(RELOAD_FLAG)) return
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }

    // Clear the flag once the page successfully loads so future deploys can reload again.
    const clearFlag = () => {
      sessionStorage.removeItem(RELOAD_FLAG)
    }

    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.message) || isChunkLoadError(event.error?.name) || isChunkLoadError(event.error?.message)) {
        reloadOnce()
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = typeof reason === 'string' ? reason : reason?.message || reason?.name
      if (isChunkLoadError(message)) {
        reloadOnce()
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    window.addEventListener('load', clearFlag)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('load', clearFlag)
    }
  }, [])

  return null
}
