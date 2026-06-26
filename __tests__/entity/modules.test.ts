import { createInMemoryEntityStore } from '@/lib/entity/store'
import { SafetyController } from '@/lib/entity/safety'
import { Marketing } from '@/lib/entity/marketing'
import { Revenue } from '@/lib/entity/revenue'
import { SelfHealing } from '@/lib/entity/self-healing'
import type { AICaller, EntityActor } from '@/lib/entity/types'

const actor: EntityActor = { id: 'admin-1', email: 'admin@example.com' }

function setup(reply: string) {
  const store = createInMemoryEntityStore()
  const safety = new SafetyController(store, actor)
  const ai: AICaller = async () => reply
  return { store, safety, ai }
}

describe('Marketing', () => {
  it('files a content draft as a pending, medium-permission proposal (never auto-published)', async () => {
    const { store, safety, ai } = setup('Title: Five invoicing tips\nBody copy here.')
    const action = await new Marketing(ai, safety).generateDraft({
      channel: 'linkedin',
      topic: 'invoicing tips',
    })
    expect(action.module).toBe('marketing')
    expect(action.permission).toBe('medium')
    expect(action.status).toBe('pending')
    expect(action.payload.content).toContain('Five invoicing tips')
    // Nothing was executed automatically.
    expect(store.audit.some((a) => a.action === 'entity.action_executed')).toBe(false)
  })
})

describe('Revenue', () => {
  it('computes ARPU, churn rate and net new customers deterministically', () => {
    const { safety, ai } = setup('')
    const report = new Revenue(ai, safety).analyze({
      mrr: 1000,
      activeSubscriptions: 10,
      newCustomers30d: 3,
      churnedCustomers30d: 1,
    })
    expect(report.derived.arpu).toBe(100)
    expect(report.derived.netNewCustomers).toBe(2)
    expect(report.derived.churnRate).toBeCloseTo(1 / 11)
    expect(report.insights.length).toBeGreaterThan(0)
  })

  it('handles empty metrics without dividing by zero', () => {
    const { safety, ai } = setup('')
    const report = new Revenue(ai, safety).analyze({})
    expect(report.derived.arpu).toBe(0)
    expect(report.derived.churnRate).toBe(0)
  })

  it('files a recommendation as a pending, medium-permission proposal', async () => {
    const { safety, ai } = setup('Consider an annual plan and a dunning sequence.')
    const revenue = new Revenue(ai, safety)
    const report = revenue.analyze({ mrr: 100, activeSubscriptions: 5 })
    const action = await revenue.recommend(report)
    expect(action.module).toBe('revenue')
    expect(action.permission).toBe('medium')
    expect(action.status).toBe('pending')
    expect(action.payload.recommendations).toContain('annual')
  })
})

describe('SelfHealing', () => {
  it('files a fix proposal as a pending, HIGH-permission action and never auto-applies it', async () => {
    const { store, safety, ai } = setup('Root cause: null deref. Fix: guard. Rollback: revert commit.')
    const action = await new SelfHealing(ai, safety).analyze({
      title: 'TypeError: cannot read foo',
      message: 'foo is undefined',
    })
    expect(action.module).toBe('self_healing')
    expect(action.permission).toBe('high')
    expect(action.status).toBe('pending')
    expect(action.payload.diagnosis).toContain('Root cause')
    // A free-text reply (no ---PATCH--- section) stays review-only: no patch.
    expect(action.payload.patch).toBeUndefined()
    expect(store.audit.some((a) => a.action === 'entity.action_executed')).toBe(false)
  })

  it('carries a structured patch when the AI returns a valid ---PATCH--- block', async () => {
    const reply = [
      '1) Likely root cause: null deref',
      '2) Suggested fix: add a guard',
      '3) Risk & rollback notes: low; revert the PR',
      '---PATCH---',
      JSON.stringify({
        commitMessage: 'fix: guard against null client',
        branchName: 'entity/fix-null',
        files: [{ path: 'lib/foo.ts', contents: 'export const x = 1\n' }],
      }),
    ].join('\n')
    const { safety, ai } = setup(reply)
    const action = await new SelfHealing(ai, safety).analyze({ title: 'TypeError: cannot read foo' })

    expect(action.payload.diagnosis).toContain('Likely root cause')
    const patch = action.payload.patch as { commitMessage: string; files: { path: string }[] }
    expect(patch.commitMessage).toBe('fix: guard against null client')
    expect(patch.files).toHaveLength(1)
    expect(patch.files[0].path).toBe('lib/foo.ts')
  })

  it('stays review-only when the ---PATCH--- block is empty/malformed', async () => {
    const reply = '1) cause\n2) fix\n3) risk\n---PATCH---\n{}'
    const { safety, ai } = setup(reply)
    const action = await new SelfHealing(ai, safety).analyze({ title: 'Some error' })
    expect(action.payload.patch).toBeUndefined()
    expect(action.payload.diagnosis).toContain('cause')
  })
})
