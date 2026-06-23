import { createClient } from '@/lib/supabase/server'
import { ROLES, isAdminEmail, normalizeRole, hasRequiredRole } from './roles'

// Re-export the pure helpers so server code can import everything it needs for
// role checks from a single module.
export * from './roles'

// Resolves the effective role for the current request from the Supabase session
// cookie. Kept in a server-only module because it depends on `@/lib/supabase/server`
// (which uses `next/headers`) and must never be pulled into a client/edge bundle.
export async function getCurrentUserRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { role: null, user: null, error: 'Unauthorized' }
  }

  // Email-based admin bootstrap takes precedence over the stored role so the
  // designated owner can always access the admin area, even if their
  // public.users row is missing or still defaults to `viewer`.
  if (isAdminEmail(user.email)) {
    return { role: ROLES.ADMIN, user, error: null }
  }

  // Use maybeSingle so a missing profile row resolves to a safe default
  // (`viewer`) instead of surfacing a PostgREST "no rows" error that would
  // wrongly turn into a 401 for legitimate users.
  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { role: null, user, error: error.message }
  }

  return {
    role: normalizeRole(data?.role),
    user,
    error: null,
  }
}

export async function requireRole(requiredRole) {
  const result = await getCurrentUserRole()
  if (result.error || !result.role) {
    return {
      ok: false,
      status: 401,
      error: result.error || 'Unauthorized',
      ...result,
    }
  }

  if (!hasRequiredRole(result.role, requiredRole)) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden',
      ...result,
    }
  }

  return {
    ok: true,
    status: 200,
    error: null,
    ...result,
  }
}
