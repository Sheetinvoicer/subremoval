import { Commander, extractJson, normalizeModule, normalizePlan } from '@/lib/entity/commander'
import type { AICaller } from '@/lib/entity/types'

describe('extractJson', () => {
  it('parses a fenced JSON object', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('parses JSON embedded in prose', () => {
    expect(extractJson('Sure! {"a": 2} done')).toEqual({ a: 2 })
  })

  it('returns an empty object for non-JSON input', () => {
    expect(extractJson('not json at all')).toEqual({})
    expect(extractJson('')).toEqual({})
  })
})

describe('normalizeModule', () => {
  it('maps aliases and defaults unknown values to orchestrator', () => {
    expect(normalizeModule('self-healing')).toBe('self_healing')
    expect(normalizeModule('healing')).toBe('self_healing')
    expect(normalizeModule('MARKETING')).toBe('marketing')
    expect(normalizeModule('nope')).toBe('orchestrator')
    expect(normalizeModule(undefined)).toBe('orchestrator')
  })
})

describe('normalizePlan', () => {
  it('normalizes tasks, fills ids and assigns permissions', () => {
    const plan = normalizePlan('goal', {
      summary: 'summary',
      tasks: [{ title: 'A', module: 'marketing' }, { module: 'self_healing' }],
    })
    expect(plan.summary).toBe('summary')
    expect(plan.tasks).toHaveLength(2)
    expect(plan.tasks[0].permission).toBe('medium')
    expect(plan.tasks[1].id).toBe('t2')
    expect(plan.tasks[1].permission).toBe('high')
  })

  it('falls back to a generated summary and empty tasks', () => {
    const plan = normalizePlan('grow revenue', {})
    expect(plan.summary).toContain('grow revenue')
    expect(plan.tasks).toEqual([])
  })
})

describe('Commander.planGoal', () => {
  it('builds a plan from the AI response', async () => {
    const ai: AICaller = async () =>
      '{"summary":"do it","tasks":[{"id":"t1","title":"Write post","module":"marketing","dependsOn":[]}]}'
    const plan = await new Commander(ai).planGoal('grow')
    expect(plan.summary).toBe('do it')
    expect(plan.tasks[0].module).toBe('marketing')
    expect(plan.tasks[0].permission).toBe('medium')
  })

  it('does not call the AI for an empty goal', async () => {
    const ai = jest.fn()
    const plan = await new Commander(ai as unknown as AICaller).planGoal('   ')
    expect(plan.tasks).toEqual([])
    expect(ai).not.toHaveBeenCalled()
  })

  it('degrades to an empty plan when the AI returns garbage', async () => {
    const ai: AICaller = async () => 'I cannot do that'
    const plan = await new Commander(ai).planGoal('grow')
    expect(plan.tasks).toEqual([])
  })
})
