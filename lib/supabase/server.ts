import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side use.
 *
 * - With no arguments it returns a cookie-bound SSR client (via `@supabase/ssr`)
 *   so the user's browser session is shared with Route Handlers, Server
 *   Components and Server Actions. This is what makes `auth.getUser()` resolve
 *   the logged-in user (and is required for `/api/auth/role`, role guards, etc).
 * - When an `accessToken` is supplied (e.g. extracted from an `Authorization:
 *   Bearer` header) it returns a token-scoped client so PostgREST/RLS queries
 *   run as that user instead of relying on cookies.
 */
export async function createClient(accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  if (accessToken) {
    return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // `setAll` was called from a Server Component where the cookie store
          // is read-only. This can be ignored when Proxy refreshes the session.
        }
      },
    },
  })
}
