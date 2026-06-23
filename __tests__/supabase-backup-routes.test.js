const createBackupMock = jest.fn()
const pruneExpiredBackupsMock = jest.fn()
const restoreBackupMock = jest.fn()
const requireRoleMock = jest.fn()
const limitMock = jest.fn()
const orderMock = jest.fn(() => ({ limit: limitMock }))
const selectMock = jest.fn(() => ({ order: orderMock }))
const fromMock = jest.fn(() => ({ select: selectMock }))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}))

jest.mock('@/lib/backup/manager', () => ({
  createBackup: (...args) => createBackupMock(...args),
  pruneExpiredBackups: (...args) => pruneExpiredBackupsMock(...args),
  restoreBackup: (...args) => restoreBackupMock(...args),
}))

jest.mock('@/lib/auth/roles-server', () => ({
  ROLES: { ADMIN: 'admin' },
  requireRole: (...args) => requireRoleMock(...args),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: fromMock,
  })),
}))

const { GET: cronBackupGET } = require('@/app/api/cron/supabase-backup/route')
const { GET: listGET, POST: manualPOST } = require('@/app/api/admin/backups/route')
const { POST: restorePOST } = require('@/app/api/admin/backups/restore/route')

describe('Supabase backup routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'secret-123'
    requireRoleMock.mockResolvedValue({ ok: true, status: 200, error: null })
    limitMock.mockResolvedValue({ data: [{ id: 'b1' }], error: null })
  })

  it('returns unauthorized for cron backup when secret is invalid', async () => {
    const req = { headers: { get: () => 'Bearer wrong' } }
    const res = await cronBackupGET(req)
    const payload = await res.json()

    expect(res.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('runs cron backup and pruning when authorized', async () => {
    createBackupMock.mockResolvedValue({ id: 'backup-1' })
    pruneExpiredBackupsMock.mockResolvedValue(2)

    const req = { headers: { get: () => 'Bearer secret-123' } }
    const res = await cronBackupGET(req)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.backupId).toBe('backup-1')
    expect(payload.pruned).toBe(2)
    expect(createBackupMock).toHaveBeenCalledWith({ triggeredBy: 'cron' })
  })

  it('lists backup history for admin', async () => {
    const req = { url: 'http://localhost:3000/api/admin/backups?limit=10' }
    const res = await listGET(req)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.backups).toEqual([{ id: 'b1' }])
    expect(limitMock).toHaveBeenCalledWith(10)
  })

  it('returns 400 when restore request has no backupId', async () => {
    const req = { json: async () => ({}) }
    const res = await restorePOST(req)
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error).toBe('backupId is required')
  })

  it('restores backup when request is valid', async () => {
    restoreBackupMock.mockResolvedValue({ restoredBackupId: 'backup-1' })

    const req = { json: async () => ({ backupId: 'backup-1' }) }
    const res = await restorePOST(req)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.restoredBackupId).toBe('backup-1')
    expect(restoreBackupMock).toHaveBeenCalledWith('backup-1')
  })

  it('creates manual backup for admin', async () => {
    createBackupMock.mockResolvedValue({ id: 'backup-manual' })
    pruneExpiredBackupsMock.mockResolvedValue(0)

    const res = await manualPOST()
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(createBackupMock).toHaveBeenCalledWith({ triggeredBy: 'manual' })
  })
})
