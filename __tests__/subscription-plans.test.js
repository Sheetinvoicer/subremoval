const {
  PLANS,
  PLAN_ORDER,
  FEATURES,
  getPlan,
  hasFeature,
  getLimit,
  isUnlimited,
  normalizePlanName,
  resolvePriceId,
  resolvePlanFromPriceId,
  isUpgrade,
  isDowngrade,
  isSelfServe,
  isContactSales,
} = require('@/lib/subscriptions/plans')

describe('subscription plan configuration', () => {
  beforeEach(() => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro'
    process.env.STRIPE_BUSINESS_PRICE_ID = 'price_business'
    delete process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
    delete process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID
  })

  it('defines exactly the four tiers in ascending order', () => {
    expect(PLAN_ORDER).toEqual(['Free', 'Pro', 'Business', 'Enterprise'])
    expect(Object.keys(PLANS).sort()).toEqual(['Business', 'Enterprise', 'Free', 'Pro'])
  })

  it('normalizes arbitrary and unknown plan names', () => {
    expect(normalizePlanName('pro')).toBe('Pro')
    expect(normalizePlanName('  BUSINESS ')).toBe('Business')
    expect(normalizePlanName('legacy-tier')).toBe('Free')
    expect(normalizePlanName(null)).toBe('Free')
  })

  it('gates AI behind paid tiers (Free has no AI)', () => {
    expect(hasFeature('Free', FEATURES.AI_ASSISTANT)).toBe(false)
    expect(hasFeature('Pro', FEATURES.AI_ASSISTANT)).toBe(true)
    expect(hasFeature('Business', FEATURES.AI_ASSISTANT)).toBe(true)
    expect(hasFeature('Enterprise', FEATURES.AI_ASSISTANT)).toBe(true)
  })

  it('gates Business-only features correctly', () => {
    for (const feat of [FEATURES.BANK_SYNC, FEATURES.ADMIN_AI, FEATURES.AUDIT_LOG, FEATURES.SSO, FEATURES.USER_ROLES]) {
      expect(hasFeature('Free', feat)).toBe(false)
      expect(hasFeature('Pro', feat)).toBe(false)
      expect(hasFeature('Business', feat)).toBe(true)
      expect(hasFeature('Enterprise', feat)).toBe(true)
    }
  })

  it('gates Enterprise-only features correctly', () => {
    for (const feat of [FEATURES.CUSTOM_BRANDING, FEATURES.DEDICATED_SUPPORT, FEATURES.CUSTOM_INTEGRATIONS]) {
      expect(hasFeature('Business', feat)).toBe(false)
      expect(hasFeature('Enterprise', feat)).toBe(true)
    }
  })

  it('enforces Free 5-item limits and unlimited paid tiers', () => {
    expect(getLimit('Free', 'invoices')).toBe(5)
    expect(getLimit('Free', 'clients')).toBe(5)
    expect(getLimit('Free', 'expenses')).toBe(5)
    expect(getLimit('Free', 'teamMembers')).toBe(1)

    for (const resource of ['invoices', 'clients', 'expenses']) {
      expect(isUnlimited('Pro', resource)).toBe(true)
      expect(isUnlimited('Business', resource)).toBe(true)
      expect(isUnlimited('Enterprise', resource)).toBe(true)
    }
  })

  it('sets team seat limits per tier', () => {
    expect(getLimit('Free', 'teamMembers')).toBe(1)
    expect(getLimit('Pro', 'teamMembers')).toBe(1)
    expect(getLimit('Business', 'teamMembers')).toBe(5)
    expect(isUnlimited('Enterprise', 'teamMembers')).toBe(true)
  })

  it('resolves Stripe price ids only for self-serve tiers', () => {
    expect(resolvePriceId('Pro')).toBe('price_pro')
    expect(resolvePriceId('Business')).toBe('price_business')
    expect(resolvePriceId('Free')).toBeNull()
    expect(resolvePriceId('Enterprise')).toBeNull()
  })

  it('maps a price id back to its plan', () => {
    expect(resolvePlanFromPriceId('price_pro')).toBe('Pro')
    expect(resolvePlanFromPriceId('price_business')).toBe('Business')
    expect(resolvePlanFromPriceId('price_unknown')).toBeNull()
    expect(resolvePlanFromPriceId(null)).toBeNull()
  })

  it('falls back to NEXT_PUBLIC_ price ids', () => {
    delete process.env.STRIPE_PRO_PRICE_ID
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = 'price_pro_public'
    expect(resolvePriceId('Pro')).toBe('price_pro_public')
    expect(resolvePlanFromPriceId('price_pro_public')).toBe('Pro')
  })

  it('classifies billing models and upgrade direction', () => {
    expect(isSelfServe('Pro')).toBe(true)
    expect(isSelfServe('Business')).toBe(true)
    expect(isSelfServe('Free')).toBe(false)
    expect(isContactSales('Enterprise')).toBe(true)

    expect(isUpgrade('Pro', 'Business')).toBe(true)
    expect(isDowngrade('Business', 'Pro')).toBe(true)
    expect(isUpgrade('Business', 'Pro')).toBe(false)
  })
})
