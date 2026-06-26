/**
 * Central subscription tier configuration — the single source of truth for the
 * four-tier model (Free, Pro, Business, Enterprise).
 *
 * This module is intentionally pure (no side effects, no I/O at import time) so
 * it can be imported safely from server routes, client components, and tests.
 * Price IDs are read from the environment lazily inside resolvePriceId so tests
 * can mutate process.env before calling.
 */

// Feature flags gate access to functionality across the app.
export const FEATURES = {
  AI_ASSISTANT: 'aiAssistant',
  MULTI_LANGUAGE: 'multiLanguage',
  MULTI_CURRENCY: 'multiCurrency',
  USER_ROLES: 'userRoles',
  ADMIN_AI: 'adminAi',
  AUDIT_LOG: 'auditLog',
  BANK_SYNC: 'bankSync',
  PRIORITY_SUPPORT: 'prioritySupport',
  SSO: 'sso',
  CUSTOM_BRANDING: 'customBranding',
  DEDICATED_SUPPORT: 'dedicatedSupport',
  CUSTOM_INTEGRATIONS: 'customIntegrations',
}

// Billing models describe how a plan is purchased.
export const BILLING_MODELS = {
  FREE: 'free',
  SELF_SERVE: 'self_serve',
  CONTACT_SALES: 'contact_sales',
}

// null in a limit means "unlimited".
const UNLIMITED = null

const PRO_FEATURES = [FEATURES.AI_ASSISTANT, FEATURES.MULTI_LANGUAGE, FEATURES.MULTI_CURRENCY]

const BUSINESS_FEATURES = [
  ...PRO_FEATURES,
  FEATURES.USER_ROLES,
  FEATURES.ADMIN_AI,
  FEATURES.AUDIT_LOG,
  FEATURES.BANK_SYNC,
  FEATURES.PRIORITY_SUPPORT,
  FEATURES.SSO,
]

const ENTERPRISE_FEATURES = [
  ...BUSINESS_FEATURES,
  FEATURES.CUSTOM_BRANDING,
  FEATURES.DEDICATED_SUPPORT,
  FEATURES.CUSTOM_INTEGRATIONS,
]

/**
 * The canonical plan definitions. `rank` enables upgrade/downgrade comparisons.
 * `priceIdEnv` is the base environment variable name; resolvePriceId also checks
 * the NEXT_PUBLIC_ prefixed variant for backwards compatibility.
 */
export const PLANS = {
  Free: {
    name: 'Free',
    rank: 0,
    monthlyPrice: 0,
    currency: 'USD',
    billingModel: BILLING_MODELS.FREE,
    priceIdEnv: null,
    limits: { invoices: 5, clients: 5, expenses: 5, teamMembers: 1 },
    features: [],
  },
  Pro: {
    name: 'Pro',
    rank: 1,
    monthlyPrice: 9,
    currency: 'USD',
    billingModel: BILLING_MODELS.SELF_SERVE,
    priceIdEnv: 'STRIPE_PRO_PRICE_ID',
    limits: { invoices: UNLIMITED, clients: UNLIMITED, expenses: UNLIMITED, teamMembers: 1 },
    features: PRO_FEATURES,
  },
  Business: {
    name: 'Business',
    rank: 2,
    monthlyPrice: 29,
    currency: 'USD',
    billingModel: BILLING_MODELS.SELF_SERVE,
    priceIdEnv: 'STRIPE_BUSINESS_PRICE_ID',
    limits: { invoices: UNLIMITED, clients: UNLIMITED, expenses: UNLIMITED, teamMembers: 5 },
    features: BUSINESS_FEATURES,
  },
  Enterprise: {
    name: 'Enterprise',
    rank: 3,
    monthlyPrice: null, // custom pricing
    currency: 'USD',
    billingModel: BILLING_MODELS.CONTACT_SALES,
    priceIdEnv: null,
    limits: { invoices: UNLIMITED, clients: UNLIMITED, expenses: UNLIMITED, teamMembers: UNLIMITED },
    features: ENTERPRISE_FEATURES,
  },
}

// Ordered list of plan names, cheapest → most expensive.
export const PLAN_ORDER = ['Free', 'Pro', 'Business', 'Enterprise']

export const DEFAULT_PLAN = 'Free'

/**
 * Normalize an arbitrary plan label (any case, legacy values) to a canonical
 * plan name. Unknown values fall back to the default (Free) plan.
 */
export function normalizePlanName(name) {
  if (!name) return DEFAULT_PLAN
  const lower = String(name).trim().toLowerCase()
  const match = PLAN_ORDER.find((plan) => plan.toLowerCase() === lower)
  return match || DEFAULT_PLAN
}

/** Return the full plan definition for a name (always defined, defaults to Free). */
export function getPlan(name) {
  return PLANS[normalizePlanName(name)]
}

/** True when the plan grants the given feature. */
export function hasFeature(name, feature) {
  return getPlan(name).features.includes(feature)
}

/**
 * Return the numeric limit for a resource, or null when unlimited.
 * Unknown limit keys return null (treated as unlimited / not enforced).
 */
export function getLimit(name, key) {
  const limits = getPlan(name).limits
  return key in limits ? limits[key] : UNLIMITED
}

/** True when the resource is unlimited for the given plan. */
export function isUnlimited(name, key) {
  return getLimit(name, key) === UNLIMITED
}

function readEnvPriceId(envBase) {
  if (!envBase) return null
  return process.env[envBase] || process.env[`NEXT_PUBLIC_${envBase}`] || null
}

/**
 * Resolve the configured Stripe price ID for a plan. Returns null for Free and
 * Enterprise (which are not purchased via self-serve checkout).
 */
export function resolvePriceId(name) {
  const plan = getPlan(name)
  if (plan.billingModel !== BILLING_MODELS.SELF_SERVE) return null
  return readEnvPriceId(plan.priceIdEnv)
}

/**
 * Map a Stripe price ID back to a canonical plan name, or null if it does not
 * correspond to any configured self-serve plan.
 */
export function resolvePlanFromPriceId(priceId) {
  if (!priceId) return null
  for (const name of PLAN_ORDER) {
    const plan = PLANS[name]
    if (plan.billingModel !== BILLING_MODELS.SELF_SERVE) continue
    if (readEnvPriceId(plan.priceIdEnv) === priceId) return name
  }
  return null
}

/** Compare two plans by rank. */
export function comparePlans(a, b) {
  return getPlan(a).rank - getPlan(b).rank
}

export function isUpgrade(from, to) {
  return comparePlans(from, to) < 0
}

export function isDowngrade(from, to) {
  return comparePlans(from, to) > 0
}

/** True when switching plans requires modifying an existing Stripe subscription. */
export function isSelfServe(name) {
  return getPlan(name).billingModel === BILLING_MODELS.SELF_SERVE
}

export function isContactSales(name) {
  return getPlan(name).billingModel === BILLING_MODELS.CONTACT_SALES
}
