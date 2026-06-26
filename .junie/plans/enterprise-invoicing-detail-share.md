# Requirements

### Overview & Goals
Continue the **enterprise invoicing upgrade** (`.junie/plans/enterprise-invoicing-upgrade.md`). The List slice (Steps 1–2) and the first Detail slice (Step 3 — status timeline, partial-payment tracking, owner-visible history log) are complete and green. This phase delivers **Step 4 — Detail page: threaded comments, a time-limited public share link (revoke + view analytics), and print CSS**, behind the existing `invoiceDetailV2` feature flag, reusing the established stack (Supabase + RLS, the service-role admin client, `next-intl`, Sentry, `recordAuditLog`).

### Scope
**In Scope**
- New owner-scoped tables `invoice_comments` (threaded, `team|client` audience) and `invoice_share_links` (unguessable token, optional expiry, revocation, `view_count`/`last_viewed_at`) in one migration (RLS, idempotent policies, indexes), plus an atomic view-bump RPC.
- Owner API routes: `app/api/invoices/comments/route.ts` (list/add/delete threaded comments) and `app/api/invoices/share/route.ts` (create/revoke a share token), both bearer-authenticated under RLS; share create/revoke mirrored to `invoice_history` + `audit_logs`.
- A **service-role** public route `app/api/public/invoice/[token]/route.ts` that validates token expiry/revocation, returns a **sanitized** invoice payload, and atomically bumps view analytics — never the anon client.
- A **view-only** public page `app/(public)/invoice/[token]/page.tsx` that calls only that API and renders a sanitized, branded, read-only invoice with clean print output; **no payment action and no comments** are exposed publicly (confirmed with user).
- Detail-page integration behind `invoiceDetailV2`: `CommentThread` + `ShareLinkPanel`, a Print button, and a `@media print` stylesheet.
- Locale-complete strings across all 8 locales (RTL-correct `ar`), WCAG 2.1 AA controls, Sentry spans, tests.

**Out of Scope (deferred)**
- Create/Edit and Generation slices (Steps 5–6).
- Public posting/reading of comments on the share page (this phase keeps comments **internal team-only**; the public page shows none).
- A "Pay now" action on the share page (view-only this phase; the legacy `app/pay/[id]` route is left untouched).
- Per-view event analytics table (aggregate `view_count`/`last_viewed_at` only, matching the master-plan schema).

### User Stories
- As a finance user, I want to leave threaded internal notes on an invoice so my team can discuss it in context.
- As a user, I want to generate a time-limited public link to an invoice, see how many times it was viewed, and revoke it instantly.
- As a recipient, I want to open a shared link and see a clean, read-only invoice without logging in.
- As a user, I want to print an invoice cleanly without the dashboard chrome.
- As an international user, I want all new controls and the public page localized and RTL-correct.

### Functional Requirements
- **Comments:** owner can list, add (optionally as a reply via `parent_id`, with `audience ∈ {team, client}`), and delete own comments for an invoice; all under RLS. Threads render parent → children.
- **Share links:** owner can create a link (optional `expires_at`), copy its URL, view its `view_count`/`last_viewed_at`, and revoke it (sets `revoked_at`). Create/revoke write an `invoice_history` row and mirror to `audit_logs`.
- **Public route:** a link is valid only when `revoked_at IS NULL` and (`expires_at IS NULL` OR `expires_at > now()`); a valid token returns a sanitized invoice (number, status, currency, totals, line items, client display name, dates — **no** user_id, notes-by-default, internal metadata, comments, or history) and atomically increments `view_count` + sets `last_viewed_at`; an invalid/expired/revoked/unknown token returns `404`.
- **Public page:** read-only; shows expired/revoked/not-found states clearly; prints cleanly; never queries Supabase directly.
- **Print:** a Print action on the detail page produces a clean invoice (no sidebar/header/search/footer/action buttons) via `@media print`.

### Non-Functional Requirements
- All new UI strings localized in `en, es, fr, de, it, pt, tr, ar`; the existing `invoices` i18n parity test stays green (whole-namespace key + ICU placeholder parity, no empty values).
- WCAG 2.1 AA: labelled controls, ARIA live regions for async results (copy/revoke/post), keyboard-operable, semantic comment thread (`ul`/`li`), `aria-current` where relevant.
- Share/comments/public flows wrapped in Sentry spans; failures reported via `Sentry.captureException`; the service-role key stays server-only; tokens are unguessable (≥ 32 bytes, base64url).
- New surface stays behind `invoiceDetailV2` for safe Vercel rollout/rollback.

# Technical Design

### Current Implementation
- **Detail page** `app/dashboard/invoices/[id]/page.tsx` (`'use client'`) loads a single invoice (`*, clients(name,email)`) + `time_entries` + (behind `invoiceDetailV2`) `invoice_payments`/`invoice_history` via the browser Supabase client under RLS, and renders `StatusTimeline`/`PaymentTracker`/`InvoiceHistoryLog`. It uses `useTranslations('invoices')`.
- **Root layout** `app/layout.tsx` already wraps **every** route in `NextIntlClientProvider` with server messages and sets `<html dir>` from `rtlLocales`, so a new top-level `app/(public)/invoice/[token]/page.tsx` gets messages + RTL automatically (no per-page i18n wiring).
- **Dashboard layout** `app/dashboard/layout.tsx` renders chrome (`Sidebar`, `DashboardHeader`, `SearchBar`, `Footer`, `AIAssistant`, `OnboardingTour`) around `children`; `globals.css` has **no** `@media print` rules yet.
- **Patterns to reuse:**
  - Owner-scoped RLS via DO-guarded idempotent policies + `begin..commit` migration shape (`202606252036_add_invoice_payments_and_history.sql`, `202606242036_add_audit_logs.sql`).
  - Bearer-auth server route → `createClient(accessToken)` + `supabase.auth.getUser(accessToken)` under RLS (`app/api/invoices/payments/route.ts`, `app/api/invoices/export/route.ts`).
  - **Service-role** admin client `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` (`lib/audit/log.js`) — the model for the public token route (bypasses RLS to validate a token without a logged-in user).
  - `recordAuditLog({action, actor, resourceType, resourceId, metadata, request})` (fire-and-forget) for the admin trail.
  - Sentry spans as in `app/api/invoices/payments/route.ts`; `isFeatureEnabled('invoiceDetailV2')` (defined, defaults ON).
- **Legacy `app/pay/[id]/page.tsx`** reads invoices via the anon client (`@/lib/supabase/public`) relying on loose RLS — **deliberately not reused**; the new share page uses the service-role API instead.

> Per the `nextjs-agent-rules` guideline: before wiring the route handlers, consult `node_modules/next/dist/docs/` for Next.js 16 route-handler/runtime/dynamic-params conventions (params are async). The write routes follow the `runtime='nodejs'` + `dynamic='force-dynamic'` shape already validated for `app/api/invoices/payments/route.ts`.

### Key Decisions (confirmed with user)
- **Scope = full Step 4** — threaded comments + revocable, time-limited public share link (view analytics) + print CSS.
- **Public page is view-only** — sanitized, branded, read-only; **no** payment action (legacy `/pay/[id]` untouched).
- **Comments are internal team-only this phase** — the `audience` column (`team|client`) is kept for master-plan parity and forward-compat, but the public page renders **no** comments and accepts none.
- **Service-role public route, never the anon client** — `app/api/public/invoice/[token]/route.ts` validates token state, returns a sanitized payload, and atomically bumps analytics; the public page calls only this API.
- **Writes via authenticated routes; owner reads via the browser client** under RLS (parity with the existing detail page) for comments + the active share link.
- **Append-only audit posture** — share create/revoke and (optionally) comment events write `invoice_history` and mirror high-value actions to `audit_logs`.

### Proposed Changes
- **`supabase/migrations/<ts>_add_invoice_comments_and_share_links.sql`** (new) — `invoice_comments` + `invoice_share_links` with owner-scoped RLS (idempotent DO-guarded policies), indexes, and a SECURITY DEFINER `increment_invoice_share_view(p_token text)` RPC for an atomic, RLS-safe view bump.
- **`lib/invoices/share.ts`** (new) — pure, framework-agnostic helpers: `generateShareToken()` (node `crypto`, base64url), `isShareLinkActive(link, now?)`, `shareLinkState(link, now?)` → `active|expired|revoked`, `sanitizePublicInvoice(invoice)` (whitelist public fields), and `COMMENT_AUDIENCES`/types. Token generation isolated so the rest stays trivially unit-testable.
- **`app/api/invoices/comments/route.ts`** (new) — `runtime='nodejs'`, bearer-auth; `GET ?invoiceId=` lists threaded comments; `POST` adds one (`body`, `audience?`, `parentId?`); `DELETE ?id=` removes own; Sentry spans.
- **`app/api/invoices/share/route.ts`** (new) — `runtime='nodejs'`, bearer-auth; `GET ?invoiceId=` returns the active link (if any); `POST` creates a token (optional `expiresInDays`/`expiresAt`); `DELETE ?id=`/`PATCH` revokes; writes `invoice_history` + mirrors to `audit_logs`; Sentry spans.
- **`app/api/public/invoice/[token]/route.ts`** (new) — `runtime='nodejs'`, `dynamic='force-dynamic'`; service-role client; validate token via `shareLinkState`; on `active`, call the bump RPC and return `sanitizePublicInvoice(...)`; otherwise `404` with a typed reason.
- **`app/(public)/invoice/[token]/page.tsx`** (new) — `'use client'`; fetches `/api/public/invoice/[token]`; renders a sanitized read-only branded invoice; expired/revoked/not-found states; Print button; uses `useTranslations('invoices.public')`.
- **`components/invoices/CommentThread.tsx`** + **`ShareLinkPanel.tsx`** (new) — accessible, localized, Sentry-instrumented; posted into the detail page.
- **`app/dashboard/invoices/[id]/page.tsx`** — behind `invoiceDetailV2`: load comments + active share link via the browser client (RLS), render `CommentThread`/`ShareLinkPanel`, add a Print button and `.invoice-print-area`/`.no-print` markers.
- **`app/globals.css`** — a `@media print` block (hide chrome + action controls, show only `.invoice-print-area`).
- **`messages/*.json` (8 locales)** — add `invoices.detail.comments.*`, `invoices.detail.share.*`, `invoices.detail.print.*`, and `invoices.public.*`.

### Data Models / Contracts
```sql
create table public.invoice_comments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.invoice_comments(id) on delete cascade,
  audience  text not null default 'team' check (audience in ('team','client')),
  body      text not null,
  created_at timestamptz not null default now()
);
create table public.invoice_share_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  token     text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- atomic, RLS-safe view bump for the service-role public route
create or replace function public.increment_invoice_share_view(p_token text)
returns void language sql security definer set search_path = public as $$
  update public.invoice_share_links
     set view_count = view_count + 1, last_viewed_at = now()
   where token = p_token and revoked_at is null
     and (expires_at is null or expires_at > now());
$$;
```
```ts
// lib/invoices/share.ts
export type ShareLinkState = 'active' | 'expired' | 'revoked'
export function generateShareToken(bytes?: number): string          // crypto, base64url
export function shareLinkState(link: { expires_at?: string|null; revoked_at?: string|null }, now?: Date): ShareLinkState
export function isShareLinkActive(link: {...}, now?: Date): boolean
export function sanitizePublicInvoice(inv: Record<string, unknown>): PublicInvoice  // field whitelist
```
```ts
// app/api/public/invoice/[token]/route.ts
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
// GET  -> 200 { invoice: PublicInvoice }  on active token (and bumps analytics)
//      -> 404 { error, reason: 'not_found'|'expired'|'revoked' }  otherwise
```

### Architecture Diagram
```mermaid
graph TD
  Page[invoices/[id]/page.tsx] --> CT[CommentThread]
  Page --> SP[ShareLinkPanel]
  CT -->|list/add/delete RLS| CAPI[api/invoices/comments]
  SP -->|create/revoke| SAPI[api/invoices/share]
  CAPI --> SB[(Supabase invoice_comments)]
  SAPI --> SB2[(Supabase invoice_share_links)]
  SAPI -->|mirror high-value| AUD[(audit_logs via recordAuditLog)]
  Visitor[Public visitor] --> PUB[(public)/invoice/[token]/page]
  PUB --> PAPI[api/public/invoice/[token]]
  PAPI -->|service role: validate + bump| SB2
  Page --> SENTRY[Sentry spans]
```

### Risks
- **Public data leakage:** the public route runs as service-role (bypassing RLS), so correctness rests entirely on token validation + payload sanitization — covered by `sanitizePublicInvoice` (field whitelist) and negative-access tests (expired/revoked/unknown).
- **Token guessability:** ≥ 32 random bytes (base64url) via node `crypto`; `unique` constraint on `token`.
- **View-bump atomicity:** done in a single SQL statement via the SECURITY DEFINER RPC (no read-modify-write race).
- **Print bleed:** the detail page lives under the dashboard chrome; the `@media print` rule must reliably hide all chrome and non-invoice controls (`.no-print`) and show only `.invoice-print-area`.
- **i18n parity forcing function:** every new key must land in all 8 locales or the parity test fails (intended).
- **Cross-user access:** comments/share writes run under RLS as the authenticated user; cross-user invoice ids resolve to null — negative tests included.

# Testing

### Validation Approach
Jest + Testing Library for components/routes and pure-logic unit tests for `lib/invoices/share.ts`, plus the existing i18n parity test, `npm run lint` (touched files), and `npm run build`.

### Key Scenarios
- `shareLinkState`/`isShareLinkActive`: active vs expired vs revoked across boundary timestamps; `sanitizePublicInvoice` strips non-whitelisted fields (user_id, internal metadata) and keeps display fields.
- Comments route: 401 without bearer; add/list (threaded parent→child)/delete own; cross-user invoice blocked.
- Share route: 401 without bearer; create returns a token + URL; revoke sets `revoked_at`; create/revoke write history + audit mirror.
- Public route: `200` + sanitized payload + view bump on an active token; `404` for expired/revoked/unknown (with reason); never returns sensitive fields.
- Public page: renders a read-only invoice for a valid token; shows expired/revoked/not-found states; print button present.
- `CommentThread`/`ShareLinkPanel`: post a comment and see it appear; create a link, copy, and revoke with ARIA live feedback.
- i18n parity stays green across all 8 locales.

### Edge Cases
- Empty comment thread / no share link → accessible empty states.
- Expiry exactly at `now` treated as expired; revoked-then-revisited returns 404.
- RTL (`ar`) layout for the new panels and the public page.
- Printing hides chrome + all action buttons; only the invoice prints.
- Cross-user comment/share/invoice ids cannot be read or mutated (RLS) — negative-access tests.

### Test Changes
- **Add:** `__tests__/invoices-share.test.ts` (state + sanitization), `__tests__/invoices-comments-route.test.js`, `__tests__/invoices-share-route.test.js`, `__tests__/invoices-public-invoice-route.test.js` (auth/validity/sanitization), and component tests `__tests__/invoices-comment-thread.test.tsx` / `__tests__/invoices-share-link-panel.test.tsx`.
- **Reuse:** existing `invoices-i18n-parity.test.js` (now also guarding the new keys).

# Delivery Steps

### ✓ Step 1: Migration (comments + share links + bump RPC) + share lib + unit tests
Owner-scoped `invoice_comments`/`invoice_share_links` tables exist with an atomic view-bump RPC, and a tested pure helper validates tokens and sanitizes public payloads.

- Add `supabase/migrations/<ts>_add_invoice_comments_and_share_links.sql`: both tables, owner-scoped RLS via DO-guarded idempotent policies (manage-own), indexes (`invoice_id`, `(invoice_id, created_at)`, unique `token`), and a SECURITY DEFINER `increment_invoice_share_view(p_token)` RPC — wrapped in `begin..commit`.
- Add `lib/invoices/share.ts`: `generateShareToken` (node `crypto`, base64url), `shareLinkState`/`isShareLinkActive`, `sanitizePublicInvoice` (field whitelist), `COMMENT_AUDIENCES`.
- Add `__tests__/invoices-share.test.ts` covering active/expired/revoked state, token shape, and sanitization (keeps display fields, drops sensitive ones).

### ✓ Step 2: Owner API routes — comments + share (create/revoke) + tests
Authenticated routes manage threaded comments and share tokens under RLS, with share events written to history + audit.

- Add `app/api/invoices/comments/route.ts` (`runtime='nodejs'`): bearer-auth; `GET ?invoiceId=` (threaded list), `POST` (add: `body`, `audience?`, `parentId?`), `DELETE ?id=` (own); Sentry spans; validate the invoice belongs to the user.
- Add `app/api/invoices/share/route.ts` (`runtime='nodejs'`): bearer-auth; `GET ?invoiceId=` (active link), `POST` (create token via `generateShareToken`, optional expiry), `DELETE ?id=`/revoke; write `invoice_history` (`share.created`/`share.revoked`) and mirror to `audit_logs`; Sentry spans.
- Add `__tests__/invoices-comments-route.test.js` and `__tests__/invoices-share-route.test.js` (401 without bearer, happy paths, revoke, cross-user blocked) with a mocked Supabase + `recordAuditLog`.

### ✓ Step 3: Public token route + public view-only page + print CSS + i18n
A shared link opens a sanitized, read-only, printable invoice via the service-role API; analytics are bumped; invalid links are rejected.

- Before wiring, consult `node_modules/next/dist/docs/` for Next.js 16 route-handler/async-params conventions (per `nextjs-agent-rules`).
- Add `app/api/public/invoice/[token]/route.ts` (`runtime='nodejs'`, `dynamic='force-dynamic'`): service-role client; load the link by token; `shareLinkState` → on `active` call `increment_invoice_share_view` + return `sanitizePublicInvoice(invoice)`, else `404` with a typed reason; Sentry spans.
- Add `app/(public)/invoice/[token]/page.tsx` (`'use client'`): fetch the public API, render a sanitized read-only branded invoice, handle expired/revoked/not-found, and a Print button; localize via `invoices.public.*`.
- Add a `@media print` block to `app/globals.css` (hide chrome + `.no-print`, show only `.invoice-print-area`); add `invoices.public.*` + `invoices.detail.print.*` strings to all 8 locales (RTL-correct `ar`).
- Add `__tests__/invoices-public-invoice-route.test.js` (active → 200 + bump + sanitized; expired/revoked/unknown → 404; never leaks sensitive fields).

### ✓ Step 4: Detail-page integration (CommentThread + ShareLinkPanel + print) + full verification
The detail page renders comments and the share panel behind the flag, prints cleanly, and the whole suite is green.

- Add `components/invoices/CommentThread.tsx` (semantic threaded list, add/delete via the route, audience selector, ARIA live result) and `ShareLinkPanel.tsx` (create/copy/revoke link, show expiry + `view_count`/`last_viewed_at`, ARIA live), both Sentry-instrumented and localized.
- Refactor `app/dashboard/invoices/[id]/page.tsx`: behind `isFeatureEnabled('invoiceDetailV2')`, load `invoice_comments` + the active `invoice_share_links` row via the browser client (RLS), render the two panels, add a Print button, and wrap the invoice in `.invoice-print-area` with `.no-print` on action controls.
- Add `invoices.detail.comments.*` + `invoices.detail.share.*` to all 8 locales (keeping parity green); add `__tests__/invoices-comment-thread.test.tsx` and `__tests__/invoices-share-link-panel.test.tsx`.
- Finish with the i18n parity test, the new tests, the prior invoice tests, `npm run lint` (touched files), and `npm run build`.
