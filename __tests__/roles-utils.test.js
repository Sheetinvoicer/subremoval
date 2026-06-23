import {
  hasRequiredRole,
  normalizeRole,
  ROLES,
  getAdminEmails,
  isAdminEmail,
} from '@/lib/auth/roles'

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

describe('admin email bootstrap', () => {
  const originalEnv = process.env.ADMIN_EMAILS

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = originalEnv
  })

  it('falls back to the owner email when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS
    expect(getAdminEmails()).toContain('f3027075@gmail.com')
    expect(isAdminEmail('f3027075@gmail.com')).toBe(true)
    expect(isAdminEmail('F3027075@GMAIL.COM')).toBe(true)
  })

  it('parses a comma/space/semicolon separated ADMIN_EMAILS list', () => {
    process.env.ADMIN_EMAILS = 'a@x.com, b@y.com; c@z.com'
    expect(getAdminEmails()).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
    expect(isAdminEmail('b@y.com')).toBe(true)
    expect(isAdminEmail('f3027075@gmail.com')).toBe(false)
  })

  it('rejects non-admin and invalid emails', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail('viewer@example.com')).toBe(false)
    expect(isAdminEmail('')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })
})
