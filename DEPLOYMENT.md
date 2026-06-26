# SheetInvoicer Deployment Guide

## 1. Deploy to Vercel

1. Push repository to GitHub/GitLab/Bitbucket.
2. Import project in Vercel.
3. Set **Framework Preset** to Next.js.
4. Set Node.js runtime to `24.x`.
5. Add environment variables from `.env.example`.
6. Deploy.

## 2. Environment Variables Setup

Use the values from your providers and set them in:

- Vercel Project Settings → Environment Variables
- `.env.local` for local testing

At minimum configure:

- Supabase keys and URL
- Stripe secret and webhook secret
- Resend API key
- App URL
- CRON secret
- AI provider keys

## 3. Supabase Setup

1. Create a Supabase project.
2. Configure authentication providers used by your app.
3. Create required tables (invoices, clients, expenses, recurring templates, etc.).
4. Configure Row Level Security policies.
5. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 4. Stripe Setup

1. Create Stripe account and enable required payment methods.
2. Add key:
   - `STRIPE_SECRET_KEY`
3. Configure webhook endpoint:
   - URL: `https://<your-domain>/api/stripe/webhook`
4. Subscribe to relevant events (for example checkout/payment completion).
5. Save webhook signing secret as:
   - `STRIPE_WEBHOOK_SECRET`

## 4.1 Live Bank Sync Webhook

The live bank sync feature exposes `/api/webhooks/stripe/bank`, which imports
balance transactions from connected Stripe accounts and auto-reconciles them
against open invoices. It is separate from the billing webhook above.

1. In the Stripe Dashboard, add a **Connect** webhook endpoint (events on
   connected accounts):
   - URL: `https://<your-domain>/api/webhooks/stripe/bank`
2. Subscribe to the balance/bank events:
   - `balance.available`, `charge.succeeded`, `charge.captured`,
     `charge.refunded`, `payout.paid`, `payout.created`, `payout.failed`,
     `financial_connections.account.refreshed_transactions`
3. Save the signing secret as:
   - `STRIPE_BANK_WEBHOOK_SECRET` (falls back to `STRIPE_WEBHOOK_SECRET` if unset)
4. Apply the migration that streams transactions to the dashboard in real time:
   - `supabase/migrations/202606250019_enable_realtime_transactions.sql`
     (adds `public.transactions` to the `supabase_realtime` publication)

## 5. Resend Email Setup

1. Create Resend account.
2. Verify sender domain.
3. Generate API key and set:
   - `RESEND_API_KEY`
4. Set public app URL used in emails:
   - `NEXT_PUBLIC_APP_URL`

## 6. AI API Setup

SheetInvoicer can use OpenAI and/or Anthropic.

Set one or both:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Optional model tuning keys can be added according to `lib/ai/config.js` behavior.

## 7. Scheduled Jobs (Cron)

Protected endpoints:

- `/api/cron/generate-recurring`
- `/api/cron/send-reminders`
- `/api/cron/entity-detect` (Entity auto-detection; runs every 6 hours per `vercel.json`)

Requirements:

- Set `CRON_SECRET`
- Send header `Authorization: Bearer <CRON_SECRET>` from your scheduler

Vercel Cron example targets these routes on configured schedule.

## 8. Entity Operations Layer (Apply + Auto-Detect)

The admin-only **Entity** dashboard (`/dashboard/entity`) can open pull requests
for approved AI fix proposals and auto-detect issues. It is human-in-the-loop:
it never merges or deploys — CI runs the tests on the PR, a human merges, and
Vercel deploys on merge.

### Database migrations

Apply both Entity migrations in the Supabase SQL editor (or via the CLI):

- `supabase/migrations/202606260500_add_entity_system.sql` — `entity_commands`,
  `entity_actions`, `entity_settings` (admin-only RLS via `public.is_admin()`).
- `supabase/migrations/202606260600_add_entity_alerts.sql` — `entity_alerts`
  (auto-detected issues; same admin-only RLS).

### Apply (GitHub) — required for the Apply button

Create a fine-grained GitHub token with `contents:write` and
`pull_requests:write` on the app repo, then set:

- `GITHUB_TOKEN`
- `GITHUB_REPO` (`owner/name`)
- `GITHUB_BASE_BRANCH` (optional; defaults to `main`)

The CI gate workflow `.github/workflows/entity-pr-checks.yml` (already in the
repo) runs `lint` + `test` on every Entity PR before a human merges. If GitHub is
not configured, Apply fails with a clear message and the rest of the Entity still
works.

### Auto-detection providers (all optional; missing ones are skipped)

- Sentry: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Vercel: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (optional)
- Performance: `PERF_METRICS_URL` (optional JSON endpoint of slow routes)
- Critical-alert email (optional): `ENTITY_ALERT_EMAIL` (reuses the existing
  `RESEND_API_KEY`)

Detection runs on the `/api/cron/entity-detect` cron (protected by `CRON_SECRET`)
and can also be triggered from the dashboard via **Scan now**.

## 9. Post-Deployment Validation Checklist

- App loads and authentication works.
- Invoice create/send flow works.
- Stripe checkout + webhook updates function correctly.
- Email sending works (welcome + invoice + reminders).
- AI routes return non-empty responses.
- Cron endpoints run with valid secret.
- Entity migrations applied; `/dashboard/entity` loads, **Scan now** works, and an
  approved fix with a patch can be applied (opens a PR).
