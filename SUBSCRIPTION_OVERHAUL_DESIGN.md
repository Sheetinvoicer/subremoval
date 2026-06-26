# Subscription Plan Overhaul — Technical Design (for approval)

> Status: **APPROVED & IMPLEMENTED.** Built behind review; **NOT deployed** — deployment deferred to a human (see §11).
> Decisions: monthly-only pricing; downgrades use immediate prorated credit; team seats and SSO built **functionally**; Enterprise "Contact sales" → `mailto:info@sheetinvoicer.com`.

## 1. Goal & scope

Replace the current ad‑hoc 3‑plan setup with a clean **4‑tier** model — **Free, Pro, Business, Enterprise** — with consistent feature gating, billing, proration on plan changes, a safe data migration, and full translations across all 8 locales.

### In scope
- Single source‑of‑truth tier configuration (limits + feature flags).
- Server‑enforced feature gating (DB‑level for count limits + API‑level for feature access) and client‑side UX gating (upgrade prompts).
- Billing: self‑serve checkout for Pro/Business; **Enterprise = "Contact sales"** (no self‑serve price).
- Proration on upgrade/downgrade between paid tiers via Stripe.
- DB schema migration + backfill + subscriber mapping (no data loss; existing users keep their plan).
- i18n for `subscription` namespace across `ar, de, en, es, fr, it, pt, tr`.
- Automated tests.

### Out of scope (explicit non‑goals)
- **Deployment to production** (per decision: implement, no deploy).
- Creating Stripe products/prices (confirmed already created; we only wire price IDs via env).
- Building a full Enterprise self‑serve billing flow (Enterprise is contact‑sales).
- New payment providers; building a team‑management product beyond what already exists.

## 2. Current state (verified in code)

| Area | Today | Issue |
|---|---|---|
| Plans (UI) | Hardcoded `Free/Pro/Business` in `app/dashboard/subscription/page.tsx` | No Enterprise; features are display‑only strings |
| Plan source of truth | `public.subscriptions.plan` (text, default `'Free'`, one row/user, RLS) | OK — reused |
| Plan read paths | `components/Sidebar.tsx`, `app/dashboard/subscription/page.tsx` | OK |
| Price → plan map | `lib/subscriptions/store.js#resolvePlanFromPriceId` (Pro/Business via env) | Extend for 4 tiers |
| Checkout | `app/api/stripe/create-subscription/route.js`, `app/api/stripe/create-checkout/route.js` | Add Business/Enterprise handling |
| Webhook | `app/api/stripe/webhook/route.js` (updates plan/status; sets `Free` on delete) | Reuse, verify 4‑tier |
| Cancel | `app/api/stripe/cancel-subscription/route.js` | Reuse |
| Plan change / proration | **none** | New route required |
| Feature gating | `lib/subscription.js#canCreateInvoice` is **dead code** (no callers), reads a **non‑existent** `user_profiles` table, runs **client‑side**, hardcodes `5` | Replace with real gating |
| i18n | `subscription` namespace exists in all 8 locales (`messages/*.json`); `ar` is RTL | Extend keys |
| Framework | **Next.js 16** with root `proxy.ts` (the renamed middleware); role gating already lives there via `lib/auth/roles` | Mirror pattern for plan gating |

**Conclusion:** there is effectively **no real feature gating today**; this is greenfield for gating but must integrate with existing billing/webhook plumbing.

## 3. Tier & feature matrix (from product spec)

| Capability | Free | Pro ($9/mo) | Business ($29/mo) | Enterprise (custom) |
|---|---|---|---|---|
| Invoices | 5 | Unlimited | Unlimited | Unlimited |
| Clients | 5 | Unlimited | Unlimited | Unlimited |
| Expenses | 5 | Unlimited | Unlimited | Unlimited |
| Basic reports | ✓ | ✓ | ✓ | ✓ |
| AI Assistant | — | ✓ | ✓ | ✓ |
| Multi‑language | — | ✓ | ✓ | ✓ |
| Multi‑currency | — | ✓ | ✓ | ✓ |
| Team members | 1 | 1 | 5 | Unlimited |
| User roles | — | — | ✓ | ✓ |
| Admin AI | — | — | ✓ | ✓ |
| Audit log | — | — | ✓ | ✓ |
| Bank sync | — | — | ✓ | ✓ |
| Priority support | — | — | ✓ | ✓ |
| SSO | — | — | ✓ | ✓ |
| Custom branding | — | — | — | ✓ |
| Dedicated support | — | — | — | ✓ |
| Custom integrations | — | — | — | ✓ |
| Billing model | n/a | self‑serve | self‑serve | **Contact sales** |

## 4. Central tier configuration (single source of truth)

New module **`lib/subscriptions/plans.js`** — pure, no side effects, importable by server, client, and tests:

```js
export const FEATURES = { AI_ASSISTANT:'aiAssistant', MULTI_LANGUAGE:'multiLanguage',
  MULTI_CURRENCY:'multiCurrency', USER_ROLES:'userRoles', ADMIN_AI:'adminAi',
  AUDIT_LOG:'auditLog', BANK_SYNC:'bankSync', PRIORITY_SUPPORT:'prioritySupport',
  SSO:'sso', CUSTOM_BRANDING:'customBranding', DEDICATED_SUPPORT:'dedicatedSupport',
  CUSTOM_INTEGRATIONS:'customIntegrations' }

// rank enables upgrade/downgrade comparisons; UNLIMITED = null
export const PLANS = {
  Free:       { rank:0, monthlyPrice:0,    priceIdEnv:null,
                limits:{ invoices:5, clients:5, expenses:5, teamMembers:1 }, features:[] },
  Pro:        { rank:1, monthlyPrice:9,    priceIdEnv:'STRIPE_PRO_PRICE_ID',
                limits:{ invoices:null, clients:null, expenses:null, teamMembers:1 },
                features:[AI_ASSISTANT, MULTI_LANGUAGE, MULTI_CURRENCY] },
  Business:   { rank:2, monthlyPrice:29,   priceIdEnv:'STRIPE_BUSINESS_PRICE_ID',
                limits:{ invoices:null, clients:null, expenses:null, teamMembers:5 },
                features:[...Pro, USER_ROLES, ADMIN_AI, AUDIT_LOG, BANK_SYNC, PRIORITY_SUPPORT, SSO] },
  Enterprise: { rank:3, monthlyPrice:null /* custom */, priceIdEnv:null /* contact sales */,
                limits:{ invoices:null, clients:null, expenses:null, teamMembers:null },
                features:[...Business, CUSTOM_BRANDING, DEDICATED_SUPPORT, CUSTOM_INTEGRATIONS] },
}

export function getPlan(name)          // normalize → PLANS[name] or PLANS.Free
export function hasFeature(name, feat) // boolean
export function getLimit(name, key)    // number | null(unlimited)
export function resolvePriceId(name)   // env lookup; null for Free/Enterprise
export function resolvePlanFromPriceId(id) // reverse map (replaces store.js logic)
```

`lib/subscriptions/store.js` is refactored to consume `plans.js` (no duplicated price logic).

## 5. Feature gating architecture (defense in depth)

**Count limits (invoices/clients/expenses) — DB is the real boundary.** Inserts happen both client‑side (browser → Supabase under RLS) and server‑side (`lib/ai/*`). The only way to enforce uniformly is a **Postgres `BEFORE INSERT` trigger** that reads the user's plan from `subscriptions` and rejects inserts over the limit. App checks alone are bypassable.

```sql
-- pseudocode of the trigger function (per table: invoices, clients, expenses)
create function enforce_plan_limit() returns trigger as $$
declare plan text; cnt int; lim int;
begin
  select coalesce(s.plan,'Free') into plan from subscriptions s where s.user_id = NEW.user_id;
  lim := case plan when 'Free' then 5 else null end;   -- driven by a small plan_limits table
  if lim is not null then
    select count(*) into cnt from invoices where user_id = NEW.user_id;
    if cnt >= lim then raise exception 'PLAN_LIMIT_EXCEEDED' using errcode='P0001'; end if;
  end if;
  return NEW;
end $$ language plpgsql;
```

- A tiny `plan_limits` table (or inline `CASE`) keeps SQL in sync with `plans.js`; tests assert parity.
- App routes/UI catch the `PLAN_LIMIT_EXCEEDED` error and show a friendly upgrade message.

**Feature access (AI, Admin AI, bank sync, audit log, SSO, branding) — enforced at API routes** via a shared guard `lib/subscriptions/gate.js`:

```js
export async function getUserPlan(supabase, userId)  // → 'Free'|'Pro'|'Business'|'Enterprise'
export async function requireFeature(supabase, userId, feature) // throws/returns 403 helper
```

Gate insertion points (server‑side, authoritative):
- AI assistant routes + `lib/ai/complete-agent.js` / `automation.js` → `AI_ASSISTANT` (Pro+).
- Admin AI routes (`/api/admin/...` AI) → `ADMIN_AI` (Business+) in addition to existing admin role check in `proxy.ts`.
- Bank routes (`/api/bank/*`, `/api/webhooks/stripe/bank` UI entry) → `BANK_SYNC` (Business+).
- Audit log read endpoints → `AUDIT_LOG` (Business+).
- Team invite endpoint(s) → `teamMembers` limit (Business 5 / Enterprise ∞).
- Custom branding settings save → `CUSTOM_BRANDING` (Enterprise).

**Client‑side UX gating** — `hooks/usePlan.ts` exposes `{ plan, hasFeature, limits }` for showing badges, disabling buttons, and upgrade CTAs. Never a security boundary.

**Replace** `lib/subscription.js` with a thin server‑side wrapper over `gate.js` (or delete + update imports — confirmed zero current callers).

## 6. Data model & migration

New migration `supabase/migrations/<ts>_subscription_tiers.sql` (idempotent, additive, no destructive ops):

1. **Schema**
   - Add `CHECK (plan in ('Free','Pro','Business','Enterprise'))` to `subscriptions.plan` (validated as NOT VALID first, then VALIDATE to avoid locking).
   - `plan_limits` table seeded from the matrix (or rely on trigger `CASE`).
   - `BEFORE INSERT` triggers on `invoices`, `clients`, `expenses` calling `enforce_plan_limit()`.
2. **Backfill (selected: "Backfill tier on users")**
   - Insert a default `Free` subscriptions row for every `auth.users` id that has none (idempotent `ON CONFLICT DO NOTHING`), so gating works retroactively.
3. **Move existing subscribers (selected)**
   - Existing `Pro`/`Business` rows are **left unchanged** (they keep their plan). Nobody is auto‑moved to Enterprise. Any legacy/unknown `plan` values are normalized to the nearest valid tier (logged), defaulting unknown → `Free` only if not a paying status.
   - **No data loss**: migration never deletes rows or downgrades active paid subscribers.

A companion `scripts/verify-subscription-migration.mjs` prints a before/after distribution of `plan` counts for human review (read‑only).

## 7. Billing & checkout changes

- `create-subscription` / `create-checkout`: resolve price via `plans.resolvePriceId(plan)`. Pro/Business → Stripe Checkout. **Enterprise → no checkout**; return a `contactSales` action; UI shows "Contact sales" (mailto/route) instead of a Buy button. Free → no checkout.
- `webhook/route.js`: keep persisting plan from `resolvePlanFromPriceId` (now 4‑tier aware via `plans.js`); unchanged event handling.
- Env vars used (already configured in Stripe per decision): `STRIPE_PRO_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` (+ `NEXT_PUBLIC_` fallbacks). No Enterprise price.

## 8. Proration / plan changes (new)

New route **`app/api/stripe/change-plan/route.js`** for users with an existing active subscription switching **between Pro and Business**:

- Look up the user's `stripe_subscription_id`; retrieve the subscription item.
- `stripe.subscriptions.update(subId, { items:[{ id, price:newPriceId }], proration_behavior:'create_prorations' })`.
- **Upgrade (Pro→Business):** immediate, prorated charge for the remainder of the period.
- **Downgrade (Business→Pro):** recommended **`proration_behavior:'create_prorations'`** crediting unused time (configurable to schedule at period end if preferred — open question Q3).
- New→paid from Free still goes through Checkout (no existing subscription to modify).
- Webhook `customer.subscription.updated` already syncs the new plan to `subscriptions.plan`.
- The subscription page calls `change-plan` when the user already has a paid plan, else `create-subscription`.

## 9. UI changes

- `app/dashboard/subscription/page.tsx`: render the 4 tiers from `plans.js` (not hardcoded), show current plan, Upgrade/Downgrade/Contact‑sales buttons, and proration note on switch.
- `components/Sidebar.tsx`: already reads plan; add a plan badge + upgrade nudge when on Free.
- Reusable `<FeatureGate feature=…>` / `<UpgradePrompt>` components to wrap gated UI (AI, bank, audit, branding).

## 10. Internationalization

- Extend the existing `subscription` namespace in **all 8** `messages/*.json` with: tier display names, per‑feature labels, "Contact sales", proration/upgrade/downgrade copy, and gating/upsell messages (e.g., `limitReached`, `featureLocked`).
- Keep keys identical across locales; `ar` remains RTL (already handled app‑wide).
- Add a **test that asserts locale key parity** (every locale has the same `subscription` keys) to prevent missing translations.

## 11. Rollout & deployment (NO auto‑deploy)

Per decision, I will **not** deploy. I will deliver code + migration + a **deployment runbook** for a human:
1. Confirm `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` set in Vercel.
2. Apply the new Supabase migration to **staging** first; run `verify-subscription-migration.mjs`.
3. Smoke‑test gating (Free limits, AI/bank locks), checkout, and a Pro↔Business proration in Stripe **test mode**.
4. Promote to production via the normal Vercel flow; re‑run the post‑deploy checklist in `DEPLOYMENT.md` §8.
5. Rollback plan: migration is additive; triggers can be dropped to disable enforcement without data loss.

## 12. Testing strategy

- **Unit** (`__tests__/subscription-plans.test.js`): `plans.js` matrix, `hasFeature`, `getLimit`, `resolvePriceId`/`resolvePlanFromPriceId` for all 4 tiers; SQL‑vs‑config limit parity.
- **Gating** (`__tests__/subscription-gate.test.js`): `getUserPlan`, `requireFeature` 403 paths (mock Supabase).
- **Routes** (mirror `__tests__/stripe-routes.test.js`): `change-plan` upgrade/downgrade with mocked Stripe; Enterprise → contact‑sales (no checkout); webhook 4‑tier mapping.
- **i18n**: locale key‑parity test for the `subscription` namespace.
- **Migration**: assert backfill + normalization SQL logic (statement‑level review + a test on the limit `CASE`).
- Run the **full** `npm test` plus targeted suites; nothing weakened/skipped.

## 13. File‑by‑file change list

**New**
- `lib/subscriptions/plans.js` — tier config + helpers.
- `lib/subscriptions/gate.js` — server feature/limit guards.
- `hooks/usePlan.ts` — client plan/feature hook.
- `components/FeatureGate.tsx`, `components/UpgradePrompt.tsx`.
- `app/api/stripe/change-plan/route.js` — proration.
- `supabase/migrations/<ts>_subscription_tiers.sql` — constraint, limits, triggers, backfill.
- `scripts/verify-subscription-migration.mjs` — read‑only verification.
- Tests listed in §12.

**Modified**
- `lib/subscriptions/store.js` — use `plans.js`.
- `app/api/stripe/create-subscription/route.js`, `app/api/stripe/create-checkout/route.js` — 4‑tier + Enterprise contact‑sales.
- `app/api/stripe/webhook/route.js` — verify 4‑tier mapping.
- `app/dashboard/subscription/page.tsx`, `components/Sidebar.tsx` — render from config, gating UI.
- AI/bank/admin/audit/branding API routes — insert `requireFeature` guards.
- `lib/subscription.js` — replaced by `gate.js` (or removed; no callers).
- `messages/{ar,de,en,es,fr,it,pt,tr}.json` — extended keys.

## 14. Next.js 16 compliance

Project is **Next.js 16** (root `proxy.ts`, async request APIs, new route‑handler conventions). Before writing code I will read the in‑repo Next 16 docs (the `node_modules/next/dist/docs/` path referenced in guidelines was not found; I will locate the actual docs under `node_modules/next` and follow them, including the `proxy.ts` middleware replacement and any deprecations).

## 15. Risks & assumptions

- **R1 — client‑side inserts bypass app checks** → mitigated by DB triggers (§5).
- **R2 — proration surprises** for downgrades → default behavior chosen but flagged as Q3.
- **R3 — "SSO/custom integrations/dedicated support"** are largely commercial/ops features; we gate their UI/flags but do not build full SSO IdP integration in this pass (Q4).
- **R4 — locale completeness** → enforced by parity test.
- **A1** — `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` already valid in the target Stripe account.
- **A2** — Team‑member limits assume an existing/at‑least‑minimal team model; otherwise team gating ships as config + guard only (Q4).

## 16. Decisions (resolved with the user)

- **Q1 — Billing interval:** monthly only ($9 Pro, $29 Business). ✓
- **Q2 — Enterprise "Contact sales":** `mailto:info@sheetinvoicer.com`. ✓
- **Q3 — Downgrade proration:** immediate prorated credit (`create_prorations`). ✓
- **Q4 — Team management & SSO:** built **functionally** this pass (tables, RLS, seat/feature gating, APIs, UI). Custom integrations remain gate-only. ✓
- **Q5 — Deployment:** "Implement, no deploy" — delivered for human review; **not deployed**. ✓

> Note: SSO records and gates the domain registration in-app; completing live SSO still requires identity-provider/SAML provisioning in Supabase Auth, which cannot be configured or end-to-end tested from this environment.
