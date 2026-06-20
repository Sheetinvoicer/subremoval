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

  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

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
