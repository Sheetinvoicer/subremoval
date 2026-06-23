import { createClient } from '@/lib/supabase/server'

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  VIEWER: 'viewer',
}

export const ROLE_HIERARCHY = {
  [ROLES.VIEWER]: 1,
  [ROLES.STAFF]: 2,
  [ROLES.ADMIN]: 3,
}

// Comma/space/semicolon-separated list of emails that should always be treated
// as admins. Configure via the `ADMIN_EMAILS` env var; the project owner is
// included as a safe default so the admin area is reachable out of the box.
const DEFAULT_ADMIN_EMAILS = 'f3027075@gmail.com'

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS
  return raw
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false
  return getAdminEmails().includes(email.toLowerCase())
}

export function normalizeRole(role) {
  if (!role || typeof role !== 'string') return ROLES.VIEWER
  const normalized = role.toLowerCase()
  return Object.values(ROLES).includes(normalized) ? normalized : ROLES.VIEWER
}

export function hasRequiredRole(userRole, requiredRole) {
  const current = ROLE_HIERARCHY[normalizeRole(userRole)]
  const required = ROLE_HIERARCHY[normalizeRole(requiredRole)]
  return current >= required
}

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
