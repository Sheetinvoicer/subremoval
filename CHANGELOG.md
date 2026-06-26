# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Subscription plan overhaul — four tiers (Free, Pro, Business, Enterprise):
  - Central tier configuration (`lib/subscriptions/plans.js`) as the single
    source of truth for prices, limits, feature flags, and Stripe price mapping.
  - Server-side gating helpers (`lib/subscriptions/gate.js`) plus database
    enforcement: migration `202606250411_subscription_tiers.sql` adds a plan
    `CHECK` constraint, a `plan_limits` table, and `BEFORE INSERT` triggers
    capping Free invoices/clients/expenses at 5.
  - Proration endpoint `POST /api/stripe/change-plan` (immediate
    `create_prorations`) for Pro↔Business switches; Enterprise is "Contact sales".
  - Functional team seats (`/api/team`) and SSO domain registration (`/api/sso`)
    with RLS, seat/feature gating, and management UI on the subscription page.
  - AI Assistant gated to Pro and above; `usePlan` hook + `FeatureGate`/
    `UpgradePrompt` components; subscription page rendered from config.
  - `subscriptionPlans` translations across all 8 locales (parity-tested).
  - Read-only `scripts/verify-subscription-migration.mjs` for post-migration checks.

### Notes

- Implemented for review and **not deployed** (per the "implement, no deploy"
  decision). See `SUBSCRIPTION_OVERHAUL_DESIGN.md` for the rollout runbook.
- Existing subscribers keep their current plan; users without a subscription row
  are backfilled to Free (no data loss).

## [0.1.0] - 2026-06-20

### Added

- Full project documentation set:
  - `README.md`
  - `openapi.yaml`
  - `USER_GUIDE.md`
  - `DEVELOPER_GUIDE.md`
  - `DEPLOYMENT.md`
  - `CONTRIBUTING.md`
  - `.env.example`
- OpenAPI/Swagger-ready API contract for existing app routes.

### Fixed

- Replaced default starter README with app-specific usage and setup guidance.

### Breaking Changes

- Documentation baseline established; future contributor workflow should follow `CONTRIBUTING.md` and environment conventions in `.env.example`.
