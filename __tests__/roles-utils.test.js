import { hasRequiredRole, normalizeRole, ROLES } from '@/lib/auth/roles'

describe('roles utilities', () => {
  it('normalizes known roles and falls back to viewer', () => {
    expect(normalizeRole('ADMIN')).toBe(ROLES.ADMIN)
    expect(normalizeRole('staff')).toBe(ROLES.STAFF)
    expect(normalizeRole('unknown')).toBe(ROLES.VIEWER)
    expect(normalizeRole(null)).toBe(ROLES.VIEWER)
  })

  it('enforces hierarchy admin > staff > viewer', () => {
    expect(hasRequiredRole(ROLES.ADMIN, ROLES.STAFF)).toBe(true)
    expect(hasRequiredRole(ROLES.STAFF, ROLES.VIEWER)).toBe(true)
    expect(hasRequiredRole(ROLES.VIEWER, ROLES.STAFF)).toBe(false)
  })
})
