import { createInMemoryEntityStore } from '@/lib/entity/store'
import { SafetyController } from '@/lib/entity/safety'
import { SelfHealing } from '@/lib/entity/self-healing'
import { runDetection } from '@/lib/entity/detector'
import type { DetectedSignal, MonitorClient } from '@/lib/entity/monitor'
import type { AICaller, EntityActor } from '@/lib/entity/types'

const actor: EntityActor = { id: 'admin-1', email: 'admin@example.com' }

function fakeMonitor(signals: DetectedSignal[]): MonitorClient {
  return { async collectSignals() { return signals } }
}

function sentrySignal(overrides: Partial<DetectedSignal> = {}): DetectedSignal {
  return {
    source: 'sentry',
    fingerprint: 'sentry:123',
    title: 'TypeError: undefined is not a function',
    severity: 'high',
    details: { message: 'boom', count: 12 },
    ...overrides,
  }
}

function buildTarget(ai: AICaller = async () => 'diagnosis text') {
  const store = createInMemoryEntityStore()
  const safety = new SafetyController(store, actor)
  const selfHealing = new SelfHealing(ai, safety)
  return { store, safety, selfHealing }
}

describe('runDetection', () => {
  it('creates one alert and one pending fix proposal for a high-confidence signal', async () => {
    const { store, selfHealing } = buildTarget()
    const summary = await runDetection({ store, selfHealing }, fakeMonitor([sentrySignal()]))

    expect(summary.scanned).toBe(1)
    expect(summary.created).toBe(1)
    expect(summary.proposalsFiled).toBe(1)

    const alerts = await store.listAlerts()
    expect(alerts).toHaveLength(1)
    expect(alerts[0].status).toBe('open')
    expect(alerts[0].source).toBe('sentry')

    const proposals = await store.listActions({ status: 'pending' })
    expect(proposals).toHaveLength(1)
    expect(proposals[0].type).toBe('healing.fix')
    // The alert is linked to the proposal so the admin can jump to it.
    expect(alerts[0].linkedActionId).toBe(proposals[0].id)
    expect(store.audit.some((a) => a.action === 'entity.action_proposed')).toBe(true)
  })

  it('raises an alert without a proposal for low-severity signals', async () => {
    const { store, selfHealing } = buildTarget()
    const summary = await runDetection(
      { store, selfHealing },
      fakeMonitor([sentrySignal({ severity: 'low', fingerprint: 'sentry:low' })]),
    )

    expect(summary.created).toBe(1)
    expect(summary.proposalsFiled).toBe(0)
    expect(await store.listActions({ status: 'pending' })).toHaveLength(0)
    const alerts = await store.listAlerts()
    expect(alerts[0].linkedActionId).toBeNull()
  })

  it('de-duplicates a fingerprint that is repeated within one scan', async () => {
    const { store, selfHealing } = buildTarget()
    const summary = await runDetection(
      { store, selfHealing },
      fakeMonitor([sentrySignal(), sentrySignal()]),
    )

    expect(summary.scanned).toBe(2)
    expect(summary.created).toBe(1)
    expect(summary.duplicates).toBe(1)
    expect(await store.listAlerts()).toHaveLength(1)
    expect(await store.listActions({ status: 'pending' })).toHaveLength(1)
  })

  it('does not re-raise an alert that is already open across scans', async () => {
    const { store, selfHealing } = buildTarget()
    await runDetection({ store, selfHealing }, fakeMonitor([sentrySignal()]))
    const second = await runDetection({ store, selfHealing }, fakeMonitor([sentrySignal()]))

    expect(second.created).toBe(0)
    expect(second.duplicates).toBe(1)
    expect(await store.listAlerts()).toHaveLength(1)
    // No duplicate proposal either.
    expect(await store.listActions({ status: 'pending' })).toHaveLength(1)
  })

  it('re-raises an alert once the previous one was dismissed', async () => {
    const { store, selfHealing } = buildTarget()
    await runDetection({ store, selfHealing }, fakeMonitor([sentrySignal()]))
    const [first] = await store.listAlerts()
    await store.updateAlert(first.id, { status: 'dismissed' })

    const second = await runDetection({ store, selfHealing }, fakeMonitor([sentrySignal()]))
    expect(second.created).toBe(1)
    expect(await store.listAlerts()).toHaveLength(2)
  })

  it('still records the alert when the fix proposal cannot be filed (emergency stop)', async () => {
    const { store, safety, selfHealing } = buildTarget()
    await safety.setEmergencyStop(true)
    // The detector logs-and-swallows the proposal failure; silence the expected error.
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const summary = await runDetection({ store, selfHealing }, fakeMonitor([sentrySignal()]))

    expect(summary.created).toBe(1)
    expect(summary.proposalsFiled).toBe(0)
    const alerts = await store.listAlerts()
    expect(alerts).toHaveLength(1)
    expect(alerts[0].linkedActionId).toBeNull()
    expect(await store.listActions()).toHaveLength(0)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('collects signals from multiple sources in one pass', async () => {
    const { store, selfHealing } = buildTarget()
    const summary = await runDetection(
      { store, selfHealing },
      fakeMonitor([
        sentrySignal({ fingerprint: 'sentry:a' }),
        { source: 'vercel', fingerprint: 'vercel:deploy:1', title: 'Deployment failed', severity: 'high', details: {} },
        { source: 'performance', fingerprint: 'performance:/slow', title: 'Slow route', severity: 'medium', details: {} },
      ]),
    )

    expect(summary.created).toBe(3)
    // High-confidence: sentry + vercel → 2 proposals; performance medium → none.
    expect(summary.proposalsFiled).toBe(2)
    const sources = (await store.listAlerts()).map((a) => a.source).sort()
    expect(sources).toEqual(['performance', 'sentry', 'vercel'])
  })
})
