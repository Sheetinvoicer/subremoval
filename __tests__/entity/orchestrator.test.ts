import { Orchestrator } from '@/lib/entity/orchestrator'
import type { EntityTask } from '@/lib/entity/types'

function task(id: string, dependsOn: string[] = []): EntityTask {
  return { id, title: id, description: '', module: 'orchestrator', permission: 'safe', dependsOn }
}

describe('Orchestrator', () => {
  it('runs all independent tasks', async () => {
    const results = await new Orchestrator().run([task('a'), task('b')], async (t) => t.id, {
      concurrency: 2,
    })
    expect(results.map((r) => r.status)).toEqual(['success', 'success'])
    expect(results.map((r) => r.output)).toEqual(['a', 'b'])
  })

  it('runs a dependency before its dependent', async () => {
    const order: string[] = []
    await new Orchestrator().run(
      [task('b', ['a']), task('a')],
      async (t) => {
        order.push(t.id)
      },
      { concurrency: 1 },
    )
    expect(order).toEqual(['a', 'b'])
  })

  it('isolates a failure and skips its dependents', async () => {
    const results = await new Orchestrator().run([task('a'), task('b', ['a'])], async (t) => {
      if (t.id === 'a') throw new Error('fail a')
      return t.id
    })
    const byId = Object.fromEntries(results.map((r) => [r.taskId, r.status]))
    expect(byId.a).toBe('failed')
    expect(byId.b).toBe('skipped')
  })

  it('skips remaining tasks when stopped', async () => {
    const results = await new Orchestrator().run([task('a'), task('b')], async (t) => t.id, {
      isStopped: () => true,
    })
    expect(results.every((r) => r.status === 'skipped')).toBe(true)
  })

  it('skips tasks whose dependencies can never be satisfied', async () => {
    const results = await new Orchestrator().run([task('a', ['missing'])], async (t) => t.id)
    expect(results[0].status).toBe('skipped')
  })

  it('never exceeds the concurrency limit', async () => {
    let running = 0
    let max = 0
    const handler = async () => {
      running += 1
      max = Math.max(max, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
    }
    await new Orchestrator().run(
      [task('a'), task('b'), task('c'), task('d')],
      handler,
      { concurrency: 2 },
    )
    expect(max).toBeLessThanOrEqual(2)
  })

  it('resolves to an empty array for no tasks', async () => {
    const results = await new Orchestrator().run([], async () => undefined)
    expect(results).toEqual([])
  })
})
