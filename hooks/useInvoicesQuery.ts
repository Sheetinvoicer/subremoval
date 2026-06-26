'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/client'
import {
  buildInvoiceQuery,
  serializeInvoiceParams,
  type InvoiceQueryParams,
} from '@/lib/invoices/query'

export interface InvoiceListRow {
  id: string
  invoice_number: string
  total: number
  currency: string
  status: string
  due_date: string | null
  created_at: string
  updated_at: string | null
  client_id: string | null
  project_id: string | null
  client_name: string | null
  project_name: string | null
  tags: string[] | null
}

export type InvoiceQueryError =
  | { kind: 'supabaseInit' }
  | { kind: 'loginRequired' }
  | { kind: 'query'; message: string }

export interface UseInvoicesQueryResult {
  invoices: InvoiceListRow[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: InvoiceQueryError | null
  refetch: () => void
}

interface InternalState {
  invoices: InvoiceListRow[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: InvoiceQueryError | null
}

const INITIAL: InternalState = {
  invoices: [],
  total: 0,
  page: 1,
  pageSize: 0,
  loading: true,
  error: null,
}

/**
 * Fetches a single server-paged slice of the current user's invoices for the
 * given {@link InvoiceQueryParams}, plus an exact total count for accessible
 * pagination. Re-runs whenever the params change (compared via their serialized
 * URL form) and exposes `refetch()` so callers can refresh after a mutation
 * (e.g. bulk actions). The actual database round-trip is wrapped in a Sentry
 * span and any failure is reported.
 */
export function useInvoicesQuery(params: InvoiceQueryParams): UseInvoicesQueryResult {
  const [state, setState] = useState<InternalState>(INITIAL)
  const [reloadToken, setReloadToken] = useState(0)

  // Stable primitive dependency so the effect only re-runs on a real change.
  const key = serializeInvoiceParams(params).toString()
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const supabase = createClient()
      if (!supabase) {
        if (!cancelled) setState({ ...INITIAL, loading: false, error: { kind: 'supabaseInit' } })
        return
      }

      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          if (!cancelled) setState({ ...INITIAL, loading: false, error: { kind: 'loginRequired' } })
          return
        }

        const built = buildInvoiceQuery(supabase, user.id, paramsRef.current)

        const { rowsData, total, queryError } = await Sentry.startSpan(
          { name: 'invoices.list.query', op: 'db.query' },
          async () => {
            const [rowsResult, countResult] = await Promise.all([built.rows, built.count])
            return {
              rowsData: (rowsResult.data as InvoiceListRow[] | null) || [],
              total: countResult.count ?? 0,
              queryError: rowsResult.error || countResult.error || null,
            }
          },
        )

        if (cancelled) return

        if (queryError) {
          Sentry.captureException(queryError)
          setState({
            ...INITIAL,
            loading: false,
            error: { kind: 'query', message: queryError.message || 'Query failed' },
          })
          return
        }

        setState({
          invoices: rowsData,
          total,
          page: built.page,
          pageSize: built.pageSize,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        Sentry.captureException(err)
        const message = err instanceof Error ? err.message : 'Query failed'
        setState({ ...INITIAL, loading: false, error: { kind: 'query', message } })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [key, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { ...state, refetch }
}

export default useInvoicesQuery
