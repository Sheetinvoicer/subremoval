## SheetInvoicer

SheetInvoicer is a full-stack invoicing platform for freelancers and small businesses. It helps you create invoices and estimates, manage clients and expenses, automate recurring billing and reminders, and accept online payments.

## Features

- Invoice lifecycle: draft → sent → paid
- Estimate creation and conversion workflows
- Client management with contact details and invoice linking
- Expense tracking for reporting and profitability visibility
- Recurring invoice templates + scheduled generation
- Payment portal with Stripe Checkout integration
- Email workflows (invoice sending, reminders, welcome messages)
- AI assistant endpoints for invoice/business actions
- Internationalization (i18n) support and locale switching
- Dashboard analytics and reports

### Screenshot placeholders

- `[Screenshot Placeholder] Dashboard overview`
- `[Screenshot Placeholder] Invoice editor`
- `[Screenshot Placeholder] Clients management`
- `[Screenshot Placeholder] Expenses management`
- `[Screenshot Placeholder] Reports dashboard`
- `[Screenshot Placeholder] Recurring invoices`
- `[Screenshot Placeholder] Payment portal`

## Tech Stack

- **Frontend/App**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Data/Auth**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe
- **Email**: Resend
- **AI**: OpenAI / Anthropic through `lib/ai/config.js`
- **Testing**: Jest + Testing Library
- **Monitoring/Analytics**: Sentry, Vercel Analytics, PostHog

## Installation & Setup

### Prerequisites

- Node.js `24.x`
- npm `>=10`
- Supabase project
- Stripe account

### Steps

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd sheetinvoicer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Fill all required values in `.env.local`.

5. Run the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Environment Variables

See the full variable list and descriptions in `.env.example`.

Core groups:

- Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional publishable key)
- Email (`RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`)
- Scheduled jobs (`CRON_SECRET`)
- AI providers (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Observability (`NEXT_PUBLIC_SENTRY_DSN`, PostHog keys)

## API Documentation

- OpenAPI specification: `openapi.yaml`
- In-app API docs page: `/api-docs`

## Deployment Guide

Use `DEPLOYMENT.md` for complete deployment instructions, including:

- Vercel setup
- Supabase configuration
- Stripe webhook setup
- Resend domain/API setup
- AI provider configuration

## Contributing

See `CONTRIBUTING.md` for:

- Local development workflow
- Branch and PR process
- Testing requirements and quality checks

## License

This project is currently distributed as **proprietary/internal** unless a separate LICENSE file states otherwise.

If you plan to open source this repository, add a `LICENSE` file and update this section.
