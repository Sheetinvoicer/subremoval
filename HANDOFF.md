# SubRemoval — Project Handoff Document

## What it is
SubRemoval scans Gmail to find forgotten subscriptions, gives cancel links.
Pricing: $4.99 one-time lifetime access. 3 scans/month.
Live at: https://subremoval.onrender.com

## Owner
- Feras Al Fanatseh — f3027075@gmail.com / alfanatsehf@gmail.com
- LLC: Feras Al Fanatseh LLC (Delaware)
- Domain: subremoval.com

## Tech Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Supabase (Postgres + Auth): project ruljiaoqscjcvhocqjtq
- Google Gemini 3.5 Flash Lite for AI email classification
- Stripe for payments (TEST MODE currently)
- Deployed on Render (free tier, cold starts after 15min idle)
- GitHub repo: https://github.com/Sheetinvoicer/subremoval

## Environment Variables
See .env.local locally + Render Dashboard → Environment.
Keys: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
GOOGLE_REDIRECT_URI, GEMINI_API_KEY, STRIPE_LIFETIME_PRICE_ID,
STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL

## Database Tables
- sr_detected_subscriptions: detected subs (service_name, amount, currency,
  billing_cycle, last_seen_at, cancel_url, status, confidence, rationale,
  source, domain, cancelled_at, amount_source, last_payment_status,
  last_failed_at, failed_attempt_count, decline_type)
- sr_gmail_tokens: OAuth tokens per user
- sr_paid_users: lifetime license (user_id, paid_at, stripe_session_id,
  scan_count_this_month, scan_period_start, lifetime)
- sr_user_excluded_domains: "not mine" list
- sr_user_identifiers: business identity to filter own emails

## Key Files
- app/page.tsx — landing page
- app/pricing/page.tsx — $4.99 pricing
- app/dashboard/page.tsx — dashboard with hero number
- app/dashboard/subscriptions/page.tsx — subscriptions list
- app/dashboard/subscriptions/scan/page.tsx — scan trigger
- app/dashboard/subscriptions/success/page.tsx — post-payment
- app/dashboard/settings/page.tsx — Gmail/billing/delete
- app/api/gmail/scan/route.ts — Gmail scan + paywall + 3/month limit
- app/api/stripe/create-checkout/route.js — $4.99 checkout
- app/api/stripe/verify-session/route.js — verify payment
- app/api/stripe/webhook/route.js — Stripe webhook
- lib/gmail/scanner.ts — Gemini AI classifier (prompt + logic)
- lib/gmail/client.ts — Gmail OAuth
- lib/gmail/knownServices.ts — fallback directory
- components/Sidebar.tsx — navigation
- components/OnboardingBanner.tsx — 3-step welcome
- messages/en.json — translations (single file, all namespaces)

## What's DONE
- Full landing page, pricing page, legal pages (privacy, terms)
- Auth (signup, login, 2FA, password reset via Supabase)
- Gmail connect + scan + subscription detection via Gemini
- Stripe checkout (TEST MODE), verify-session, webhook scaffolding
- Scan counter (3/month, resets monthly)
- Onboarding banner for new users
- Sidebar with subscription count badge
- Deployed on Render — build passes, 30 routes
- Google OAuth test users added

## What's LEFT
1. TEST the full payment flow in test mode after localhost→render fix
2. Set up STRIPE_WEBHOOK_SECRET in Render (add from Stripe test webhooks)
3. Switch to Stripe LIVE mode when ready (need live secret + live price ID)
4. Google OAuth verification (2-6 weeks, may need $500-$15K audit — apply after 20+ users)
5. Upgrade Render to $7/mo Starter before marketing (no cold starts)
6. Marketing — LinkedIn (20K connections), no paid ads yet

## Known Issues
- Google verification: 100 test user limit until approved
- Gmail uses restricted scope (gmail.readonly) — may require security audit
- Stripe price ID mismatch history — currently using test mode price_1UExS0GLkmZvBbIwwj2BEtEi

## How to resume
1. cd ~/Desktop/subremoval
2. npm run dev (local) — app at http://localhost:3000
3. Push to GitHub → Render auto-deploys
4. Test live at https://subremoval.onrender.com

## Conversation context (what user has been doing)
User is a solo founder in Jordan, built SubRemoval from a SheetInvoicer fork.
Has spent ~$1500 on development. Recently launched MVP on Render.
Next steps are marketing + Google verification + scale.

Last AI conversation focused on:
- Making signup/login redirect flow work (?next=/pricing param)
- Fixing Stripe checkout success_url to use request origin instead of localhost
- Testing the full $4.99 payment flow end-to-end
