const insertMock = jest.fn()
const createSupabaseClientMock = jest.fn(() => ({
  from: jest.fn(() => ({ insert: insertMock })),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => createSupabaseClientMock(...args),
}))

const requireRoleMock = jest.fn()
const limitMock = jest.fn()
const eqMock = jest.fn()
const orderMock = jest.fn()
const selectMock = jest.fn()
const fromMock = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}))

jest.mock('@/lib/auth/roles-server', () => ({
  ROLES: { ADMIN: 'admin' },
  requireRole: (...args) => requireRoleMock(...args),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({ from: fromMock })),
}))

const { recordAuditLog, requestContext, AUDIT_ACTIONS } = require('@/lib/audit/log')
const { GET: auditLogsGET } = require('@/app/api/admin/audit-logs/route')

function makeRequest(url) {
  return { url }
}

describe('recordAuditLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    insertMock.mockResolvedValue({ error: null })
  })

  it('rejects when action is missing', async () => {
    const result = await recordAuditLog({})
    expect(result.ok).toBe(false)
    expect(result.error).toBe('action is required')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('persists an audit row with actor and request context', async () => {
    const request = {
      headers: {
        get: (name) =>
          ({
            'x-forwarded-for': '203.0.113.7, 10.0.0.1',
            'user-agent': 'jest-agent',
          }[name] || null),
      },
    }

    const result = await recordAuditLog({
      action: AUDIT_ACTIONS.USER_ROLE_UPDATED,
      actor: { id: 'user-1', email: 'admin@example.com' },
      resourceType: 'user',
      resourceId: 42,
      metadata: { role: 'staff' },
      request,
    })

    expect(result.ok).toBe(true)
    expect(insertMock).toHaveBeenCalledWith({
      action: 'user.role_updated',
      user_id: 'user-1',
      user_email: 'admin@example.com',
      resource_type: 'user',
      resource_id: '42',
      metadata: { role: 'staff' },
      ip_address: '203.0.113.7',
      user_agent: 'jest-agent',
    })
  })

  it('never throws and reports a failed insert', async () => {
    insertMock.mockResolvedValue({ error: { message: 'db down' } })
    const result = await recordAuditLog({ action: 'x.y' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('db down')
  })

  it('swallows missing-env errors instead of throwing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const result = await recordAuditLog({ action: 'x.y' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/admin environment variables/)
  })
})

describe('requestContext', () => {
  it('returns nulls for non-request inputs', () => {
    expect(requestContext(null)).toEqual({ ipAddress: null, userAgent: null })
  })

  it('falls back to x-real-ip when no forwarded-for', () => {
    const request = {
      headers: { get: (name) => ({ 'x-real-ip': '198.51.100.5' }[name] || null) },
    }
    expect(requestContext(request)).toEqual({ ipAddress: '198.51.100.5', userAgent: null })
  })
})

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requireRoleMock.mockResolvedValue({ ok: true, status: 200, error: null })
    limitMock.mockResolvedValue({ data: [{ id: 'log-1' }], error: null })
    eqMock.mockReturnValue({ eq: eqMock })
    orderMock.mockReturnValue({ limit: limitMock })
    selectMock.mockReturnValue({ order: orderMock })
    fromMock.mockReturnValue({ select: selectMock })
    // make the query chain awaitable when no filter is applied
    limitMock.mockReturnValue(
      Object.assign(Promise.resolve({ data: [{ id: 'log-1' }], error: null }), { eq: eqMock })
    )
  })

  it('returns 403 for non-admins', async () => {
    requireRoleMock.mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' })
    const res = await auditLogsGET(makeRequest('http://localhost/api/admin/audit-logs'))
    const payload = await res.json()
    expect(res.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
  })

  it('returns audit logs for admins', async () => {
    const res = await auditLogsGET(makeRequest('http://localhost/api/admin/audit-logs?limit=10'))
    const payload = await res.json()
    expect(res.status).toBe(200)
    expect(payload.logs).toEqual([{ id: 'log-1' }])
    expect(limitMock).toHaveBeenCalledWith(10)
  })

  it('applies the action filter when provided', async () => {
    await auditLogsGET(
      makeRequest('http://localhost/api/admin/audit-logs?action=user.role_updated')
    )
    expect(eqMock).toHaveBeenCalledWith('action', 'user.role_updated')
  })
})
