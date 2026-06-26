import { createInMemoryEntityStore } from '@/lib/entity/store'
import type { EntityAlert } from '@/lib/entity/types'

function makeAlert(overrides: Partial<EntityAlert> = {}): EntityAlert {
  const now = new Date().toISOString()
  return {
    id: 'alert-1',
    source: 'sentry',
    severity: 'high',
    title: 'TypeError: cannot read properties of undefined',
    fingerprint: 'sentry:typeerror-1',
    status: 'open',
    details: { culprit: 'app/page.tsx' },
    linkedActionId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('EntityStore alert CRUD', () => {
  it('inserts and reads back an alert', async () => {
    const store = createInMemoryEntityStore()
    const inserted = await store.insertAlert(makeAlert())
    expect(inserted.id).toBe('alert-1')
    const all = await store.listAlerts()
    expect(all).toHaveLength(1)
    expect(all[0].title).toContain('TypeError')
  })

  it('lists alerts newest-first', async () => {
    const store = createInMemoryEntityStore()
    await store.insertAlert(makeAlert({ id: 'a', fingerprint: 'f-a', createdAt: '2026-01-01T00:00:00.000Z' }))
    await store.insertAlert(makeAlert({ id: 'b', fingerprint: 'f-b', createdAt: '2026-02-01T00:00:00.000Z' }))
    const rows = await store.listAlerts()
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('updates an alert status without mutating other fields', async () => {
    const store = createInMemoryEntityStore()
    await store.insertAlert(makeAlert())
    const updated = await store.updateAlert('alert-1', { status: 'acknowledged' })
    expect(updated.status).toBe('acknowledged')
    expect(updated.title).toContain('TypeError')
    const reread = await store.listAlerts()
    expect(reread[0].status).toBe('acknowledged')
  })

  it('throws when updating a missing alert', async () => {
    const store = createInMemoryEntityStore()
    await expect(store.updateAlert('nope', { status: 'dismissed' })).rejects.toThrow()
  })

  it('filters by status and source', async () => {
    const store = createInMemoryEntityStore()
    await store.insertAlert(makeAlert({ id: 'a', fingerprint: 'f-a', source: 'sentry', status: 'open' }))
    await store.insertAlert(makeAlert({ id: 'b', fingerprint: 'f-b', source: 'vercel', status: 'open' }))
    await store.insertAlert(makeAlert({ id: 'c', fingerprint: 'f-c', source: 'sentry', status: 'dismissed' }))

    expect((await store.listAlerts({ status: 'open' })).map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect((await store.listAlerts({ source: 'sentry' })).map((r) => r.id).sort()).toEqual(['a', 'c'])
    expect((await store.listAlerts({ source: 'vercel', status: 'open' })).map((r) => r.id)).toEqual(['b'])
  })
})

describe('EntityStore fingerprint dedup lookup', () => {
  it('finds an existing alert by fingerprint and returns null for unknown', async () => {
    const store = createInMemoryEntityStore()
    await store.insertAlert(makeAlert({ fingerprint: 'sentry:err-x' }))
    const found = await store.findAlertByFingerprint('sentry:err-x')
    expect(found?.id).toBe('alert-1')
    expect(await store.findAlertByFingerprint('does-not-exist')).toBeNull()
  })

  it('returns the most recent alert when a fingerprint recurs', async () => {
    const store = createInMemoryEntityStore()
    await store.insertAlert(
      makeAlert({ id: 'old', fingerprint: 'dup', status: 'resolved', createdAt: '2026-01-01T00:00:00.000Z' }),
    )
    await store.insertAlert(
      makeAlert({ id: 'new', fingerprint: 'dup', status: 'open', createdAt: '2026-03-01T00:00:00.000Z' }),
    )
    const found = await store.findAlertByFingerprint('dup')
    expect(found?.id).toBe('new')
    expect(found?.status).toBe('open')
  })
})
