---
sessionId: session-260622-224936-v0tp
---

# Audit Report



# SheetInvoicer — SaaS Diagnostic Audit

Results of inspecting the actual codebase (Next.js 16, Supabase, Stripe). Each item is marked ✅ Complete / ⚠️ Partial / ❌ Broken. Items marked ⚠️/❌ that are in scope will be fixed (see Technical Design). Missing *features* (trial, in-app notifications) are reported but excluded from fixes per the "do not add new features" instruction.

## Authentication & Access
 Area | Status | Evidence |
---|---|---|
 Signup | ✅ Complete | `app/signup/page.tsx` uses `supabase.auth.signUp` with validation, terms, redirect to `/login`. |
 Login (+ 2FA, Google) | ✅ Complete | `app/login/page.tsx`: `signInWithPassword`, `/api/auth/2fa`, `signInWithOAuth`. |
 Logout | ✅ Complete | `supabase.auth.signOut()` in `components/*Sidebar.tsx`. |
 Session management | ✅ Complete | `app/api/auth/session/route.ts` + `proxy.ts` (Next.js 16 middleware convention) refreshes/guards session. |
 Role-based access | ✅ Complete | `proxy.ts` enforces `ROLES.ADMIN` on `/dashboard/admin` and `/api/admin` via `lib/auth/roles`. |
 **Password reset** | ❌ Broken | `app/login/page.tsx` posts to `/api/auth/reset-password`, but **no such route exists**. Reset always fails. → **FIX** |
 Welcome email on signup | ⚠️ Partial | `/api/auth/welcome-email` exists but is **never called** after signup. → **FIX** |

## Subscription & Billing
 Area | Status | Evidence |
---|---|---|
 Plan selection flow | ❌ Broken | `app/dashboard/subscription/page.tsx` "Upgrade" buttons have **no `onClick`** and call no API. | 
 Subscription checkout | ❌ Broken | `app/pricing/page.tsx` posts to `/api/stripe/create-subscription`, which **does not exist**. → **FIX** |
 Invoice payment (Stripe) | ✅ Complete | `/api/stripe/create-checkout` + `/api/stripe/webhook` used by `app/pay/[id]` and `app/portal/[token]`. |
 Discount endpoint | ⚠️ Partial | `components/DiscountInput.tsx` posts to `/api/discount` (missing); component is currently **orphaned** (not rendered). → **FIX (add route)** |
 Tax calculation endpoint | ⚠️ Partial | `components/TaxRateSelector.tsx` posts to `/api/stripe/calculate-tax` (missing); component **orphaned**. → **FIX (add route)** |
 Free trial logic | ❌ Not implemented | No `trial` logic anywhere in `app`, `lib`, or `supabase`. Reported; adding it would be a new feature → out of scope. |
 Upgrade/downgrade | ❌ Broken | No working plan-change path (see plan selection). → **FIX via wiring** |

## Dashboard
 Area | Status | Evidence |
---|---|---|
 User-specific data | ✅ Complete | `app/dashboard/page.tsx` loads invoices/clients/expenses filtered by user; computes stats. |
 Widgets pulling real data | ✅ Complete | Recharts fed from Supabase queries. |
 Empty states | ⚠️ Verify | To be confirmed/hardened during fix pass. |

## Onboarding
 Area | Status | Evidence |
---|---|---|
 Onboarding flow | ❌ Broken | `components/OnboardingTour.tsx` exists but is **never imported or rendered** anywhere. → **FIX (wire in)** |

## Database & API
 Area | Status | Evidence |
---|---|---|
 Endpoints called but missing | ❌ Broken | `/api/auth/reset-password`, `/api/stripe/create-subscription`, `/api/discount`, `/api/stripe/calculate-tax`. → **FIX** |
 Endpoints built but never called | ⚠️ Partial | `/api/auth/welcome-email` (wire to signup); `/api/admin/backups*` (admin-only, verify). |
 UI actions with no API | ❌ Broken | Subscription upgrade buttons. → **FIX** |

## User Management
 Area | Status | Evidence |
---|---|---|
 Profile / settings save | ✅ Complete | `app/dashboard/settings/page.tsx` `saveSettings` upserts `user_settings`. |

## Notifications
 Area | Status | Evidence |
---|---|---|
 Email triggers | ⚠️ Partial | `/api/cron/send-reminders` + `/api/cron/generate-recurring` exist; welcome email not triggered (→ FIX). |
 In-app notifications | ❌ Not implemented | Only a `notifications_enabled` settings toggle; no in-app notification system. Reported; building one = new feature → out of scope. |

## Summary of in-scope fixes
1. Password reset route (`/api/auth/reset-password`).
2. Subscription/billing wiring: `/api/stripe/create-subscription`, subscription & pricing buttons; add `/api/discount` and `/api/stripe/calculate-tax` using the existing Stripe client pattern.
3. Onboarding tour wired for new users; welcome email triggered after signup.
4. Dashboard empty-state verification + `npm run build` check.

## Explicitly out of scope (reported, not fixed)
- Free trial system (new feature).
- In-app notification system (new feature).
- Deployment (build-only per your choice).

# Technical Design



# Technical Design — Fixes

Follows existing project conventions: client pages use `@/lib/supabase/client`; API routes live under `app/api/**` (mix of `route.ts`/`route.js`); Stripe routes instantiate via a local `getStripeClient()` reading `STRIPE_SECRET_KEY`. Next.js 16 is in use (middleware = `proxy.ts`), so consult `node_modules/next/dist/docs/` before relying on any routing/handler assumption.

## 1. Password reset (❌ → ✅)
**Current:** `app/login/page.tsx#handleForgotPassword` posts `{ email }` to `/api/auth/reset-password` and expects `{ success }` / `{ error }`. Route is missing.

**Change:** Add `app/api/auth/reset-password/route.ts`:
- `POST` handler reads `{ email }`.
- Uses a Supabase server client (`@supabase/ssr`, same pattern as `app/api/auth/session/route.ts`) to call `auth.resetPasswordForEmail(email, { redirectTo: <origin>/update-password })`.
- Returns `{ success: true }` on success; `{ success: false, error }` on failure (avoid leaking whether email exists — return success generically).
- `/update-password` page already exists to complete the flow.

## 2. Subscription & billing wiring (❌/⚠️ → ✅)
**2a. `app/api/stripe/create-subscription/route.js`** (new): mirror `create-checkout` structure (`getStripeClient`, validation, `NextResponse`). Create a Stripe Checkout Session in `subscription` mode for the selected plan; return `{ url }`. Resolve plan→price via env-configured price IDs with graceful 400/500 when unset.

**2b. `app/pricing/page.tsx`**: already posts to `/api/stripe/create-subscription`; verify it redirects to the returned `url` and handles errors.

**2c. `app/dashboard/subscription/page.tsx`**: add an `onClick` to the Upgrade buttons that posts the chosen plan to `/api/stripe/create-subscription` and redirects to the Checkout `url`; disable while pending and surface errors. Keep current-plan detection from `subscriptions` table.

**2d. `app/api/discount/route.js`** (new): validate a discount/coupon code against Stripe (or a simple server-side rule reusing `getStripeClient`); return `{ valid, amountOff/percentOff }` shape expected by `components/DiscountInput.tsx`.

**2e. `app/api/stripe/calculate-tax/route.js`** (new): compute tax via Stripe Tax (or configured rate) and return the shape expected by `components/TaxRateSelector.tsx`.

## 3. Onboarding + welcome email (❌/⚠️ → ✅)
**3a.** Render `components/OnboardingTour` for new users — mount it in the dashboard (e.g. `app/dashboard/page.tsx` or `app/dashboard/layout.tsx`), gated by a persisted "seen" flag (localStorage or `user_settings`) so it shows once after first login.

**3b.** Trigger welcome email: after a successful `signUp` in `app/signup/page.tsx`, fire-and-forget `fetch('/api/auth/welcome-email', { method: 'POST', body: { email, name } })` (non-blocking, errors swallowed) so the existing route is actually used.

## 4. Dashboard empty states + build (⚠️ → ✅)
- Confirm `app/dashboard/page.tsx` renders sensible empty states when a user has zero invoices/clients/expenses (no NaN/blank charts); add minimal guards only if missing.
- Run `npm run build` to verify all routes compile (build-only; no deploy).

## Risks
- Stripe subscription/discount/tax routes depend on configured price/coupon/tax settings; new routes must fail gracefully (clear 4xx/5xx) when env config is absent, rather than crash the UI.
- Welcome-email trigger must be non-blocking so signup UX is unaffected if email infra is misconfigured.
- Onboarding gating must not re-trigger on every dashboard visit.

# Delivery Steps

### ✓ Step 1: Fix broken password reset flow
Forgot-password on the login page completes end-to-end instead of failing on a missing endpoint.

- Add `app/api/auth/reset-password/route.ts` with a `POST` handler.
- Use the `@supabase/ssr` server-client pattern (as in `app/api/auth/session/route.ts`) to call `auth.resetPasswordForEmail(email, { redirectTo: <origin>/update-password })`.
- Return `{ success: true }` generically (don't leak account existence) and `{ success: false, error }` on failure to match `app/login/page.tsx#handleForgotPassword`.
- Verify the flow lands on the existing `/update-password` page.

### ✓ Step 2: Wire subscription & billing endpoints to Stripe
Plan selection and the missing billing endpoints work using the existing Stripe client pattern.

- Add `app/api/stripe/create-subscription/route.js` mirroring `create-checkout` (`getStripeClient`, validation, `NextResponse`), creating a `subscription`-mode Checkout Session and returning `{ url }`; map plan→price via env price IDs with graceful errors when unset.
- Add `onClick` handlers to the Upgrade buttons in `app/dashboard/subscription/page.tsx` that POST the chosen plan and redirect to the returned Checkout `url`, with pending/disabled and error states.
- Verify `app/pricing/page.tsx` redirects to the returned `url` and handles errors.
- Add `app/api/discount/route.js` and `app/api/stripe/calculate-tax/route.js` returning the shapes expected by `components/DiscountInput.tsx` and `components/TaxRateSelector.tsx`, with safe failure when Stripe config is missing.

### ✓ Step 3: Wire onboarding tour and welcome email
New users are guided after signup and the existing welcome-email route is actually used.

- Mount `components/OnboardingTour` in the dashboard (`app/dashboard/page.tsx` or `app/dashboard/layout.tsx`), gated by a persisted "seen" flag so it shows once after first login and does not re-trigger.
- After a successful `supabase.auth.signUp` in `app/signup/page.tsx`, fire a non-blocking `fetch('/api/auth/welcome-email', …)` with email/name, swallowing errors so signup UX is unaffected.

### ✓ Step 4: Harden dashboard empty states and verify build
The dashboard renders cleanly for brand-new (zero-data) users and the whole app compiles.

- Confirm `app/dashboard/page.tsx` shows sensible empty states for zero invoices/clients/expenses (no NaN values or blank charts); add minimal guards only where missing.
- Run `npm run build` to verify all routes (including the new API routes) compile successfully; do not deploy.