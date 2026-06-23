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
