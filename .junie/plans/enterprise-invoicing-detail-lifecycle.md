# Requirements

### Overview & Goals
Continue the **enterprise invoicing upgrade** (`.junie/plans/enterprise-invoicing-upgrade.md`). The List slice (Step 1 query/filters/sort/search/pagination, Step 2 bulk actions + filtered CSV/PDF export) is complete and green. This phase delivers **Step 3 — Detail page: status timeline, partial-payment tracking & an owner-visible history log**, behind the existing `invoiceDetailV2` feature flag, reusing the established stack (Supabase + RLS, `next-intl`, Sentry, `recordAuditLog`).

### Scope
**In Scope**
- New owner-scoped tables `invoice_payments` and `invoice_history` (RLS, idempotent policies, indexes) in one migration; defensively allow the full status lifecycle on `invoices`.
- A `StatusTimeline` visualizing the full lifecycle (draft → sent → viewed → paid, plus overdue / disputed / cancelled).
- A `PaymentTracker` to record partial payments/credits/adjustments with a running balance; **auto-mark the invoice `paid` once payments cover the total** (manual override preserved).
- An `InvoiceHistoryLog` reading `invoice_history` (owner-visible change log), with high-value payment events additionally mirrored to `audit_logs`.
- Expand the detail page's settable statuses to the full lifecycle; write a history row on every status change.
- Locale-complete strings across all 8 locales (RTL-correct `ar`), WCAG 2.1 AA controls, Sentry spans, tests.

**Out of Scope (deferred to Step 4+)**
- Threaded comments, public share link + view analytics, print CSS (Step 4).
- Create/Edit and Generation slices (Steps 5–6).
- A `discount` column or any change to invoice money columns beyond status.

### User Stories
- As a finance user, I want to record partial payments and see the running balance so I know what's still owed.
- As a finance user, I want the invoice to flip to `paid` automatically once it's fully settled.
- As a user, I want a clear status timeline and an auditable history of changes on each invoice.
- As an international user, I want all new controls localized and RTL-correct.

### Functional Requirements
- Record a payment (`amount`, `kind` ∈ `payment|credit|adjustment`, optional `note`, `paid_at`); the running balance = `round(total - sum(amounts), 2)`.
- When `balance <= 0` and status ≠ `paid`, the server sets status `paid` and records both the payment and the status change in `invoice_history`; payment + auto-paid events are mirrored to `audit_logs`.
- The history log shows every recorded action (payment, status change) with timestamp, newest first, owner-visible only.
- Status controls cover the full lifecycle; each manual change writes an `invoice_history` row.
- All reads (payments, history) run under RLS via the browser client (parity with the existing detail page); the recording mutation runs through an authenticated server route so history + audit mirroring are centralized.

### Non-Functional Requirements
- All new UI strings localized in `en, es, fr, de, it, pt, tr, ar`; the existing `invoices` i18n parity test stays green.
- WCAG 2.1 AA: ARIA live region for balance, semantic timeline (`ol`/`li` + `aria-current`), labelled form controls, keyboard operable.
- Payment recording wrapped in Sentry spans; failures reported via `Sentry.captureException`; no secrets client-side.
- New surface stays behind `invoiceDetailV2` for safe Vercel rollout/rollback.

# Technical Design

### Current Implementation
- **Detail page** `app/dashboard/invoices/[id]/page.tsx` (`'use client'`) loads a single invoice (`*, clients(name,email)`) + `time_entries` via the browser Supabase client under RLS, renders amount/status/items, has inline status buttons (`draft|sent|paid|overdue`) and a send button. It uses `useTranslations('invoices')` and `t('status.<x>')`.
- **Patterns to reuse:** owner-scoped RLS via DO-guarded idempotent policies + `set_updated_at`/`begin..commit` migration shape (`202606251857_add_invoice_list_facets.sql`, `202606242036_add_audit_logs.sql`, `202606210320_complete_missing_schema.sql`); bearer-auth server route (`app/api/accounting/export/route.ts`, `app/api/invoices/export/route.ts`) → `createClient(accessToken)` + `supabase.auth.getUser`; `recordAuditLog({action,actor,resourceType,resourceId,metadata})` (service-role, fire-and-forget) in `lib/audit/log.js`; `formatCurrencyAmount` in `lib/currency.js`; Sentry spans as in `hooks/useInvoicesQuery.ts`; `isFeatureEnabled('invoiceDetailV2')` (already defined, defaults ON).
- **Schema note:** no `create table invoices` / status CHECK constraint exists in any migration, and the list page + i18n already reference extended statuses (`disputed`, `viewed`, `cancelled`), so expanding the settable set is feasible; the migration defensively drops any status CHECK constraint to guarantee it.

> Per the `nextjs-agent-rules` guideline: the new route handler follows the Next.js 16 route-handler/runtime conventions already validated for `app/api/invoices/export/route.ts` (`runtime='nodejs'`, `dynamic='force-dynamic'`, `Response`).

### Key Decisions (confirmed with user)
- **Scope = Step 3 only** (timeline + partial payments + history); comments/share/print deferred to Step 4.
- **Auto-mark paid when settled.** Partial payments update the balance and leave status unchanged; full coverage auto-sets `paid` (logged); manual override remains.
- **Full status lifecycle is settable** (draft, sent, viewed, paid, overdue, disputed, cancelled).
- **Recording via an authenticated server route** (`/api/invoices/payments`) so `invoice_history` writes + `audit_logs` mirroring are centralized and secure; **reads via the browser client under RLS** (parity with the existing detail page).
- **Append-only model:** corrections are made with `credit`/`adjustment` entries rather than deleting payments; `invoice_history` is owner-readable + owner-insertable, never updated/deleted.

### Proposed Changes
- **`supabase/migrations/<ts>_add_invoice_payments_and_history.sql`** (new) — `invoice_payments` + `invoice_history` with owner-scoped RLS (idempotent), indexes, and a defensive drop of any `invoices.status` CHECK constraint.
- **`lib/invoices/payments.ts`** (new) — pure money math: `computeBalance(total, payments)` → `{ paid, balance, fullyPaid }` (2-dp rounding), `INVOICE_STATUS_LIFECYCLE`, `PAYMENT_KINDS` types.
- **`app/api/invoices/payments/route.ts`** (new) — `runtime='nodejs'`, `dynamic='force-dynamic'`; bearer-auth; `POST` records a payment under RLS, recomputes balance, auto-marks `paid` when settled, writes `invoice_history`, mirrors to `audit_logs`; Sentry spans.
- **`components/invoices/StatusTimeline.tsx`**, **`PaymentTracker.tsx`**, **`InvoiceHistoryLog.tsx`** (new) — accessible, localized, Sentry-instrumented.
- **`app/dashboard/invoices/[id]/page.tsx`** — behind `invoiceDetailV2`: load payments + history, render the three components, expand settable statuses, write `invoice_history` on status change.
- **`messages/*.json` (8 locales)** — add `invoices.detail.timeline.*`, `invoices.detail.payments.*`, `invoices.detail.history.*`; ensure `invoices.status.*` has all 7 states.

### Data Models / Contracts
```sql
create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  amount    numeric(12,2) not null,
  currency  text not null default 'USD',
  kind      text not null default 'payment' check (kind in ('payment','credit','adjustment')),
  paid_at   timestamptz not null default now(),
  note      text,
  created_at timestamptz not null default now()
);
create table public.invoice_history (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  action    text not null,           -- e.g. payment.recorded, status.changed, invoice.paid
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
```
```ts
// lib/invoices/payments.ts
export const INVOICE_STATUS_LIFECYCLE = ['draft','sent','viewed','paid','overdue','disputed','cancelled'] as const
export type PaymentKind = 'payment' | 'credit' | 'adjustment'
export function computeBalance(total: number, payments: { amount: number }[]): {
  paid: number; balance: number; fullyPaid: boolean
}
```
```ts
// app/api/invoices/payments/route.ts
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
// POST { invoiceId, amount, kind?, note?, paidAt? }
//  -> 401 no/invalid bearer; 400 invalid; else { payment, paid, balance, fullyPaid, status }
```

### Architecture Diagram
```mermaid
graph TD
  Page[invoices/[id]/page.tsx] --> TL[StatusTimeline]
  Page --> PT[PaymentTracker]
  Page --> HL[InvoiceHistoryLog]
  Page -->|read payments/history RLS| SB[(Supabase invoice_payments/history)]
  PT -->|record payment| API[api/invoices/payments]
  API -->|insert payment + history, auto-paid| SB
  API -->|mirror high-value| AUD[(audit_logs via recordAuditLog)]
  API --> SENTRY[Sentry spans]
```

### Risks
- **Auto-paid correctness:** compute balance from persisted `total` and summed amounts, round to 2 dp, use an epsilon for the `fullyPaid` check.
- **Status constraint:** an unknown legacy CHECK could reject new statuses — the migration drops any `status` CHECK on `invoices` (idempotent no-op if none).
- **Data leakage:** new tables are owner-scoped RLS; the route writes as the authenticated user; negative-access covered by tests.
- **i18n parity forcing function:** new keys must land in all 8 locales or the parity test fails (intended).

# Testing

### Validation Approach
Jest + Testing Library for components/route and pure-logic unit tests for `computeBalance`, plus the existing i18n parity test, `npm run lint`, and `npm run build`.

### Key Scenarios
- `computeBalance`: payments/credits/adjustments reduce balance; 2-dp rounding; `fullyPaid` when settled/overpaid; representative cases.
- Payments route: 401 without bearer; records a payment; auto-marks `paid` when settled and writes the history rows; reports failure cleanly.
- `PaymentTracker`: records a payment, shows the updated balance via an ARIA live region, surfaces the auto-paid transition.
- `StatusTimeline`: renders the lifecycle, marks the current status (`aria-current`), localized.
- `InvoiceHistoryLog`: renders entries newest-first with localized action labels.
- i18n parity stays green across all 8 locales.

### Edge Cases
- No payments → balance equals total; empty history renders an accessible empty state.
- Overpayment → balance clamps at/through zero and still flags fully paid.
- Cross-user invoice id cannot be paid/read (RLS) — negative-access test.
- RTL (`ar`) layout for the new controls.

# Delivery Steps

### ✓ Step 1: Migration + balance lib + unit tests
Owner-scoped `invoice_payments`/`invoice_history` tables exist and a tested pure helper computes the balance.

- Add `supabase/migrations/<ts>_add_invoice_payments_and_history.sql`: both tables, owner-scoped RLS via DO-guarded idempotent policies (`invoice_payments` manage-own; `invoice_history` owner select + insert, append-only), indexes (`invoice_id`, `(invoice_id, created_at desc)`), and a defensive drop of any `invoices.status` CHECK constraint — wrapped in `begin..commit`.
- Add `lib/invoices/payments.ts`: `computeBalance` (2-dp rounding, `fullyPaid` epsilon), `INVOICE_STATUS_LIFECYCLE`, `PaymentKind`.
- Add `__tests__/invoices-payments.test.ts` for the balance math (payments/credits/adjustments, rounding, full/over payment).

### ✓ Step 2: Payments API route (record + history + audit mirror)
An authenticated route records payments, recomputes the balance, auto-marks paid, and writes history + audit rows.

- Add `app/api/invoices/payments/route.ts` (`runtime='nodejs'`, `dynamic='force-dynamic'`): bearer-auth like `app/api/invoices/export/route.ts`; validate body; insert into `invoice_payments` under RLS; recompute via `computeBalance`; if settled, update `invoices.status='paid'`; insert `invoice_history` rows (`payment.recorded`, and `invoice.paid` when auto-flipped); mirror to `audit_logs` via `recordAuditLog`; wrap in Sentry spans; return `{ paid, balance, fullyPaid, status }`.
- Add `__tests__/invoices-payments-route.test.js`: 401 without bearer, records a payment, auto-marks paid when settled (history written), and clean error handling (mock Supabase + `recordAuditLog`).

### ✓ Step 3: Detail components + i18n (timeline, tracker, history)
Three accessible, localized components render the lifecycle, payment tracking, and history.

- Add `components/invoices/StatusTimeline.tsx` (semantic `ol`, `aria-current`, lifecycle from `INVOICE_STATUS_LIFECYCLE`), `PaymentTracker.tsx` (record form + balance with ARIA live region + per-action result, posts to the route, Sentry span), `InvoiceHistoryLog.tsx` (newest-first list, localized action labels, empty state).
- Add `invoices.detail.timeline.*`, `invoices.detail.payments.*`, `invoices.detail.history.*` to all 8 locales and ensure `invoices.status.*` has all 7 states (RTL-correct `ar`), keeping the parity test green.
- Add component tests `__tests__/invoices-payment-tracker.test.tsx` (record → balance update, auto-paid surfaced) and `__tests__/invoices-status-timeline.test.tsx` (current status + a11y).

### ✓ Step 4: Integrate into the detail page + full verification
The detail page renders the new sections behind the flag, supports the full status lifecycle, and logs every change.

- Refactor `app/dashboard/invoices/[id]/page.tsx`: behind `isFeatureEnabled('invoiceDetailV2')`, load `invoice_payments` + `invoice_history` via the browser client (RLS) alongside the invoice; render `StatusTimeline`, `PaymentTracker`, `InvoiceHistoryLog`; expand settable statuses to the full lifecycle; on payment success and on every manual status change, refresh data and write an `invoice_history` row; reflect an auto-paid transition.
- Finish with the i18n parity test, the new tests, the prior invoice tests, `npm run lint` (touched files), and `npm run build`.
