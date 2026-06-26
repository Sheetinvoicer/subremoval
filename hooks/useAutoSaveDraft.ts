'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * Debounced auto-save for the invoice editor.
 *
 * Persists the editor's form state both to the browser's localStorage (instant,
 * offline-safe) and to the versioned, RLS-scoped `/api/invoices/drafts` endpoint
 * (durable, cross-device). On mount it looks for an existing draft to offer for
 * restore (server latest preferred, localStorage as a fallback). The initial
 * (loaded) state is never auto-saved — only user edits are.
 *
 * Drafts are grouped by `draftKey`: the invoice id when editing an existing
 * invoice, or the literal 'new' when creating one.
 */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AvailableDraft {
  savedAt: string | null
  source: 'server' | 'local'
}

export interface UseAutoSaveDraftOptions {
  draftKey: string
  data: unknown
  enabled?: boolean
  debounceMs?: number
}

export interface UseAutoSaveDraft {
  status: AutoSaveStatus
  lastSavedAt: string | null
  /** A pre-existing draft found on mount, offered to the user for restore. */
  availableDraft: AvailableDraft | null
  /** Returns the restorable payload behind `availableDraft` (or null). */
  restore: () => Promise<Record<string, unknown> | null>
  /** Deletes the draft locally and on the server. */
  clear: () => Promise<void>
  /** Hides the restore banner without deleting the stored draft. */
  dismiss: () => void
}

const STORAGE_PREFIX = 'invoice_draft'

function storageKey(draftKey: string): string {
  return `${STORAGE_PREFIX}:${draftKey}`
}

// Builds JSON + bearer headers from the browser session so the drafts route runs
// under the caller's RLS. Falls back to an unauthenticated request (which the
// route rejects with 401) when there's no session.
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const supabase = createClient()
  if (!supabase) return headers
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

export function useAutoSaveDraft({
  draftKey,
  data,
  enabled = true,
  debounceMs = 1500,
}: UseAutoSaveDraftOptions): UseAutoSaveDraft {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [availableDraft, setAvailableDraft] = useState<AvailableDraft | null>(null)

  // Holds the full restorable payload behind `availableDraft` (which only carries
  // display metadata) so `restore()` can return it without another round-trip.
  const candidateRef = useRef<Record<string, unknown> | null>(null)
  // Skip auto-saving the initial/loaded state — only persist real user edits.
  const primedRef = useRef(false)

  const serialized = JSON.stringify(data ?? null)
  const debouncedSerialized = useDebounce(serialized, debounceMs)

  // Re-prime whenever the editor target changes so switching invoices doesn't
  // immediately auto-save the freshly loaded state. Declared before the save
  // effect so it resets the flag first on a draftKey change.
  useEffect(() => {
    primedRef.current = false
  }, [draftKey])

  // On mount (per draftKey), look for an existing draft to offer for restore:
  // prefer the server's latest version, fall back to localStorage.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    candidateRef.current = null
    setAvailableDraft(null)

    const load = async () => {
      let local: { payload: Record<string, unknown>; savedAt: string | null } | null = null
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(storageKey(draftKey))
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed.payload === 'object') {
              local = { payload: parsed.payload, savedAt: parsed.savedAt ?? null }
            }
          }
        } catch {
          // Ignore corrupt localStorage entries.
        }
      }

      let server: { payload: Record<string, unknown>; savedAt: string | null } | null = null
      try {
        const res = await fetch(`/api/invoices/drafts?invoiceId=${encodeURIComponent(draftKey)}`, {
          headers: await authHeaders(),
        })
        if (res.ok) {
          const body = await res.json()
          if (body?.latest?.payload && typeof body.latest.payload === 'object') {
            server = { payload: body.latest.payload, savedAt: body.latest.created_at ?? null }
          }
        }
      } catch (error) {
        Sentry.captureException(error)
      }

      if (cancelled) return
      const chosen = server || local
      if (chosen) {
        candidateRef.current = chosen.payload
        setAvailableDraft({ savedAt: chosen.savedAt, source: server ? 'server' : 'local' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [draftKey, enabled])

  // Debounced auto-save to localStorage + the server, skipping the primed state.
  useEffect(() => {
    if (!enabled) return
    if (!primedRef.current) {
      primedRef.current = true
      return
    }

    const payload = JSON.parse(debouncedSerialized || 'null')
    if (!payload || typeof payload !== 'object') return

    let cancelled = false
    const savedAt = new Date().toISOString()

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey(draftKey), JSON.stringify({ payload, savedAt }))
      } catch {
        // Storage full/unavailable — the server save is still attempted.
      }
    }

    setStatus('saving')
    const save = async () => {
      try {
        const res = await fetch('/api/invoices/drafts', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ invoiceId: draftKey, payload }),
        })
        if (cancelled) return
        if (!res.ok) throw new Error(`Draft save failed: ${res.status}`)
        setStatus('saved')
        setLastSavedAt(savedAt)
      } catch (error) {
        if (cancelled) return
        Sentry.captureException(error)
        setStatus('error')
      }
    }
    save()
    return () => {
      cancelled = true
    }
  }, [debouncedSerialized, draftKey, enabled])

  const restore = useCallback(async (): Promise<Record<string, unknown> | null> => {
    return candidateRef.current
  }, [])

  const clear = useCallback(async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey(draftKey))
      } catch {
        // Ignore storage errors.
      }
    }
    try {
      await fetch(`/api/invoices/drafts?invoiceId=${encodeURIComponent(draftKey)}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
    } catch (error) {
      Sentry.captureException(error)
    }
    candidateRef.current = null
    setAvailableDraft(null)
    setStatus('idle')
    setLastSavedAt(null)
  }, [draftKey])

  const dismiss = useCallback(() => {
    candidateRef.current = null
    setAvailableDraft(null)
  }, [])

  return { status, lastSavedAt, availableDraft, restore, clear, dismiss }
}

export default useAutoSaveDraft
