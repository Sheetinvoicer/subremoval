import {
  createNotificationCenter,
  phasePercent,
  isActivePhase,
  ENTITY_STEPS,
  MAX_LOG_ENTRIES,
  type EntityNotification,
  type EntityNotificationCenter,
} from '@/lib/entity/notifications'

/** A center with deterministic ids + clock so assertions are stable. */
function fixedCenter(): EntityNotificationCenter {
  let n = 0
  return createNotificationCenter({
    idFactory: () => `id-${++n}`,
    now: () => '2026-01-01T00:00:00.000Z',
  })
}

describe('phase helpers', () => {
  it('maps each phase to a progress percentage', () => {
    expect(phasePercent('idle')).toBe(0)
    expect(phasePercent('analyzing')).toBe(25)
    expect(phasePercent('planning')).toBe(55)
    expect(phasePercent('executing')).toBe(80)
    expect(phasePercent('complete')).toBe(100)
    expect(phasePercent('error')).toBe(100)
  })

  it('flags only in-flight phases as active', () => {
    expect(isActivePhase('analyzing')).toBe(true)
    expect(isActivePhase('planning')).toBe(true)
    expect(isActivePhase('executing')).toBe(true)
    expect(isActivePhase('idle')).toBe(false)
    expect(isActivePhase('complete')).toBe(false)
    expect(isActivePhase('error')).toBe(false)
  })
})

describe('createNotificationCenter', () => {
  it('starts idle with an empty log', () => {
    const center = fixedCenter()
    const state = center.getState()
    expect(state.phase).toBe('idle')
    expect(state.percent).toBe(0)
    expect(state.stepIndex).toBe(-1)
    expect(state.label).toBeNull()
    expect(state.log).toEqual([])
  })

  it('keeps a stable snapshot reference until something changes', () => {
    const center = fixedCenter()
    const first = center.getState()
    expect(center.getState()).toBe(first)
    center.start('Command', 'Analyzing the goal…')
    expect(center.getState()).not.toBe(first)
  })

  it('drives analyzing → planning → complete and notifies on completion', () => {
    const center = fixedCenter()
    const notifications: EntityNotification[] = []
    center.subscribeNotifications((notification) => notifications.push(notification))

    center.start('Command', 'Analyzing the goal…')
    expect(center.getState().phase).toBe('analyzing')
    expect(center.getState().label).toBe('Command')
    expect(center.getState().stepIndex).toBe(0)
    expect(center.getState().percent).toBe(25)

    center.setPhase('planning', 'Building a plan…')
    expect(center.getState().phase).toBe('planning')
    expect(center.getState().stepIndex).toBe(1)

    center.complete('Plan ready.')
    const state = center.getState()
    expect(state.phase).toBe('complete')
    expect(state.percent).toBe(100)
    expect(state.stepIndex).toBe(ENTITY_STEPS.length)
    expect(state.log.map((entry) => entry.message)).toEqual([
      'Analyzing the goal…',
      'Building a plan…',
      'Plan ready.',
    ])

    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({ level: 'success', message: 'Plan ready.' })
  })

  it('records a failure on the furthest step reached and notifies as error', () => {
    const center = fixedCenter()
    const notifications: EntityNotification[] = []
    center.subscribeNotifications((notification) => notifications.push(notification))

    center.start('Marketing', 'Drafting content…')
    center.setPhase('executing')
    center.fail('Boom')

    const state = center.getState()
    expect(state.phase).toBe('error')
    expect(state.percent).toBe(100)
    expect(state.stepIndex).toBe(2) // stayed on "executing"
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({ level: 'error', message: 'Boom' })
  })

  it('appends log lines without changing the phase via log()', () => {
    const center = fixedCenter()
    center.start('Scan')
    center.log('Scanning Sentry…')
    center.log('Something odd', 'warn')
    const state = center.getState()
    expect(state.phase).toBe('analyzing')
    expect(state.log).toHaveLength(2)
    expect(state.log[1]).toMatchObject({ level: 'warn', message: 'Something odd', phase: 'analyzing' })
  })

  it('notifies state subscribers and stops after unsubscribe', () => {
    const center = fixedCenter()
    let calls = 0
    const unsubscribe = center.subscribe(() => {
      calls += 1
    })
    center.start('X')
    center.setPhase('executing')
    expect(calls).toBe(2)
    unsubscribe()
    center.complete('done')
    expect(calls).toBe(2)
  })

  it('caps the log at MAX_LOG_ENTRIES, dropping the oldest lines', () => {
    const center = fixedCenter()
    for (let i = 0; i < MAX_LOG_ENTRIES + 10; i += 1) center.log(`line ${i}`)
    const state = center.getState()
    expect(state.log).toHaveLength(MAX_LOG_ENTRIES)
    expect(state.log[0].message).toBe('line 10')
    expect(state.log[state.log.length - 1].message).toBe(`line ${MAX_LOG_ENTRIES + 9}`)
  })

  it('reset() returns to idle but keeps the log', () => {
    const center = fixedCenter()
    center.start('X', 'a line')
    center.reset()
    const state = center.getState()
    expect(state.phase).toBe('idle')
    expect(state.percent).toBe(0)
    expect(state.stepIndex).toBe(-1)
    expect(state.label).toBeNull()
    expect(state.log).toHaveLength(1)
  })

  it('clear() empties the log and returns to idle', () => {
    const center = fixedCenter()
    center.start('X', 'a line')
    center.clear()
    const state = center.getState()
    expect(state.phase).toBe('idle')
    expect(state.log).toEqual([])
    expect(state.stepIndex).toBe(-1)
  })
})
