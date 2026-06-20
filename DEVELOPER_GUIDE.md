# SheetInvoicer Developer Guide

## 1. Project Structure

- `app/` — App Router pages and API routes.
- `components/` — reusable UI components.
- `lib/` — integration clients and business utilities (AI, Supabase, logging, etc.).
- `hooks/` — custom React hooks.
- `messages/` + `i18n/` — translation dictionaries and locale setup.
- `__tests__/` — Jest test suites for routes and components.
- `scripts/` — maintenance/automation scripts.

## 2. Core Architecture

### Next.js (App Router)

- UI routes are built in `app/**/page.tsx`.
- Backend endpoints live in `app/api/**/route.*`.
- Middleware and instrumentation are used for request-level behavior and observability.

### Supabase

- Used for authentication and database access.
- Client helpers are in `lib/supabase/` for browser/server contexts.

### Stripe

- Checkout session creation endpoint: `/api/stripe/create-checkout`.
- Webhook listener endpoint: `/api/stripe/webhook`.
- Payment outcomes update invoice lifecycle and customer experience flows.

## 3. Local Development

1. Install deps:

   ```bash
   npm install
   ```

2. Configure env:

   ```bash
   cp .env.example .env.local
   ```

3. Start app:

   ```bash
   npm run dev
   ```

## 4. How to Add a New Feature

1. Define user flow + data model impact.
2. Add/update DB logic via Supabase integration layer.
3. Add App Router page(s) and/or API route(s).
4. Add translations if new user-facing copy is introduced.
5. Add tests for happy path + validation/errors.
6. Update docs (`README`, `openapi.yaml`, user/developer docs).

## 5. How to Write Tests

- Test runner: Jest.
- Preferred command:

  ```bash
  npm test
  ```

- Add route tests in `__tests__/` for:
  - request validation
  - auth checks
  - provider errors
  - success responses

### Test design guidance

- Keep tests deterministic.
- Mock external services (Stripe, Resend, AI, Supabase) at boundaries.
- Validate both status code and JSON payload shape.

## 6. Debugging Guide

- Use local dev logs (`npm run dev`) + browser console.
- Verify env values first when API routes fail.
- For webhook issues:
  - check signing secret
  - verify raw body handling
- For auth/data issues:
  - validate Supabase keys
  - confirm Row Level Security policies and table schema
- For production incidents, use Sentry dashboard and deployment logs.

## 7. Deployment (Developer Checklist)

Before deploying:

- `npm run lint`
- `npm test`
- `npm run build`
- verify all required env vars in hosting platform
- validate Stripe webhook endpoint after deployment

For full runtime setup, use `DEPLOYMENT.md`.
