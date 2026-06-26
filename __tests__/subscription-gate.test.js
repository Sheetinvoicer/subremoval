const {
  getUserPlan,
  checkFeature,
  canCreateResource,
  getSeatLimit,
} = require('@/lib/subscriptions/gate')
const { FEATURES } = require('@/lib/subscriptions/plans')

// Build a minimal Supabase client mock.
// - subscriptions.select().eq().maybeSingle() resolves the plan row
// - <table>.select(...).eq() awaits to a { count } result
function makeSupabase({ plan, counts = {}, throwOnPlan = false } = {}) {
  return {
    from(table) {
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        maybeSingle() {
          if (throwOnPlan) return Promise.reject(new Error('boom'))
          return Promise.resolve({ data: plan === undefined ? null : { plan }, error: null })
        },
        then(resolve) {
          resolve({ count: counts[table] ?? 0, data: null, error: null })
        },
      }
      return builder
    },
  }
}

describe('subscription gate', () => {
  it('reads and normalizes the user plan, defaulting to Free', async () => {
    expect(await getUserPlan(makeSupabase({ plan: 'business' }), 'u1')).toBe('Business')
    expect(await getUserPlan(makeSupabase({ plan: undefined }), 'u1')).toBe('Free')
    expect(await getUserPlan(makeSupabase({}), null)).toBe('Free')
  })

  it('falls back to Free when the plan lookup throws', async () => {
    expect(await getUserPlan(makeSupabase({ throwOnPlan: true }), 'u1')).toBe('Free')
  })

  it('grants features according to plan', async () => {
    const free = makeSupabase({ plan: 'Free' })
    const pro = makeSupabase({ plan: 'Pro' })
    const business = makeSupabase({ plan: 'Business' })

    expect((await checkFeature(free, 'u', FEATURES.AI_ASSISTANT)).allowed).toBe(false)
    expect((await checkFeature(pro, 'u', FEATURES.AI_ASSISTANT)).allowed).toBe(true)
    expect((await checkFeature(pro, 'u', FEATURES.BANK_SYNC)).allowed).toBe(false)
    expect((await checkFeature(business, 'u', FEATURES.BANK_SYNC)).allowed).toBe(true)
  })

  it('blocks Free users at the 5-item limit and allows unlimited paid tiers', async () => {
    const freeAtLimit = makeSupabase({ plan: 'Free', counts: { invoices: 5 } })
    const freeUnder = makeSupabase({ plan: 'Free', counts: { invoices: 4 } })
    const pro = makeSupabase({ plan: 'Pro', counts: { invoices: 9999 } })

    const blocked = await canCreateResource(freeAtLimit, 'u', 'invoices')
    expect(blocked.allowed).toBe(false)
    expect(blocked.limit).toBe(5)
    expect(blocked.current).toBe(5)
    expect(blocked.remaining).toBe(0)

    const ok = await canCreateResource(freeUnder, 'u', 'invoices')
    expect(ok.allowed).toBe(true)
    expect(ok.remaining).toBe(1)

    const unlimited = await canCreateResource(pro, 'u', 'invoices')
    expect(unlimited.allowed).toBe(true)
    expect(unlimited.limit).toBeNull()
  })

  it('treats unknown resources as ungated', async () => {
    const res = await canCreateResource(makeSupabase({ plan: 'Free' }), 'u', 'widgets')
    expect(res.allowed).toBe(true)
  })

  it('returns the per-plan seat limit', async () => {
    expect(await getSeatLimit(makeSupabase({ plan: 'Free' }), 'u')).toBe(1)
    expect(await getSeatLimit(makeSupabase({ plan: 'Business' }), 'u')).toBe(5)
    expect(await getSeatLimit(makeSupabase({ plan: 'Enterprise' }), 'u')).toBeNull()
  })
})
