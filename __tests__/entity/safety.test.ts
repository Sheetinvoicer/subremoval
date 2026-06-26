import { createInMemoryEntityStore } from '@/lib/entity/store'
import {
  SafetyController,
  classifyPermission,
  requiresApproval,
  EntityStoppedError,
  EntityActionError,
} from '@/lib/entity/safety'
import type { EntityActor } from '@/lib/entity/types'

const actor: EntityActor = { id: 'admin-1', email: 'admin@example.com' }

describe('classifyPermission / requiresApproval', () => {
  it('classifies known types and fails safe (high) for unknown', () => {
    expect(classifyPermission('marketing.draft')).toBe('medium')
    expect(classifyPermission('healing.fix')).toBe('high')
    expect(classifyPermission('revenue.insight')).toBe('safe')
    expect(classifyPermission('totally.unknown')).toBe('high')
  })

  it('only `safe` actions skip approval', () => {
    expect(requiresApproval('safe')).toBe(false)
    expect(requiresApproval('medium')).toBe(true)
    expect(requiresApproval('high')).toBe(true)
  })
})

describe('SafetyController', () => {
  it('leaves medium/high proposals pending and audits them', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)
    const action = await safety.propose({
      module: 'marketing',
      type: 'marketing.draft',
      title: 't',
      summary: 's',
    })
    expect(action.status).toBe('pending')
    expect(action.permission).toBe('medium')
    expect(store.audit.some((a) => a.action === 'entity.action_proposed')).toBe(true)
  })

  it('auto-executes a safe proposal when an executor is supplied', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)
    const executor = jest.fn().mockResolvedValue({ result: { ok: true } })
    const action = await safety.propose(
      { module: 'revenue', type: 'revenue.insight', title: 't', summary: 's' },
      executor,
    )
    expect(executor).toHaveBeenCalledTimes(1)
    expect(action.status).toBe('executed')
  })

  it('refuses to execute a medium/high action before it is approved', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)
    const pending = await safety.propose({
      module: 'self_healing',
      type: 'healing.fix',
      title: 't',
      summary: 's',
    })
    await expect(safety.execute(pending, async () => ({}))).rejects.toBeInstanceOf(EntityActionError)

    const approved = await safety.approve(pending.id, async () => ({ result: { applied: false } }))
    expect(approved.status).toBe('executed')
    expect(approved.decidedBy?.id).toBe('admin-1')
  })

  it('rejects a pending action so it can never be approved later', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)
    const proposal = await safety.propose({
      module: 'marketing',
      type: 'marketing.draft',
      title: 't',
      summary: 's',
    })
    const rejected = await safety.reject(proposal.id)
    expect(rejected.status).toBe('rejected')
    await expect(safety.approve(proposal.id)).rejects.toBeInstanceOf(EntityActionError)
  })

  it('only rolls back executed actions', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)
    const proposal = await safety.propose({
      module: 'marketing',
      type: 'marketing.draft',
      title: 't',
      summary: 's',
    })
    const executed = await safety.approve(proposal.id, async () => ({ rollbackState: { prev: 'pending' } }))
    const rolledBack = await safety.rollback(executed.id)
    expect(rolledBack.status).toBe('rolled_back')
    expect(store.audit.some((a) => a.action === 'entity.action_rolled_back')).toBe(true)
  })

  it('blocks every action while the emergency stop is engaged, but lets you resume', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)

    await safety.setEmergencyStop(true)
    expect(await safety.isEmergencyStopped()).toBe(true)
    await expect(
      safety.propose({ module: 'marketing', type: 'marketing.draft', title: 't', summary: 's' }),
    ).rejects.toBeInstanceOf(EntityStoppedError)

    // Releasing works even though the entity is stopped.
    await safety.setEmergencyStop(false)
    const action = await safety.propose({
      module: 'marketing',
      type: 'marketing.draft',
      title: 't',
      summary: 's',
    })
    expect(action.status).toBe('pending')
  })

  it('captures executor failures as `failed` instead of throwing', async () => {
    const store = createInMemoryEntityStore()
    const safety = new SafetyController(store, actor)
    const pending = await safety.propose({
      module: 'self_healing',
      type: 'healing.fix',
      title: 't',
      summary: 's',
    })
    const failed = await safety.approve(pending.id, async () => {
      throw new Error('boom')
    })
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('boom')
  })
})
