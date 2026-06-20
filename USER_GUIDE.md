# SheetInvoicer User Guide

## 1. Getting Started

1. Sign up and verify your account.
2. Complete your business profile in **Settings**.
3. Add at least one client.
4. Create your first invoice.

## 2. Create and Manage Invoices

- Go to **Dashboard → Invoices → New Invoice**.
- Choose a client, add line items, taxes/discounts, and due date.
- Save as draft or send directly.
- Track status from the invoices table:
  - `draft`
  - `sent`
  - `paid`
  - `overdue` (based on due date logic)

### Best practices

- Add clear payment terms in notes.
- Use consistent invoice numbering.
- Review amount and currency before sending.

## 3. Manage Clients and Expenses

### Clients

- Open **Dashboard → Clients**.
- Add contact details (name, email, billing details).
- Edit or view full history from each client profile.

### Expenses

- Open **Dashboard → Expenses**.
- Create expenses with category, amount, and date.
- Use expense records to compare income vs. spending in reports.

## 4. Use AI Features

SheetInvoicer includes AI-assisted endpoints for productivity:

- **AI Chat** (`/api/agents/chat`): ask business/invoicing questions.
- **AI Action** (`/api/ai/action`): send a task + payload for a concise action suggestion.

Tips:

- Keep prompts specific.
- Include context (invoice details, client type, constraints).
- Validate AI output before sending to clients.

## 5. Configure Settings

Go to **Dashboard → Settings**:

- Update company information.
- Configure default currency and formatting.
- Set reminder preferences.
- Manage plan/subscription in **Subscription**.

## 6. Generate Reports

Use **Dashboard → Reports** to monitor:

- Revenue by period
- Paid vs unpaid invoices
- Expense totals and trends

Recommended workflow:

1. Track all invoices and expenses consistently.
2. Review monthly report trends.
3. Adjust pricing or follow-up strategy based on payment data.

## 7. Set Up Recurring Invoices

Go to **Dashboard → Recurring**:

- Create recurring templates with frequency (weekly/monthly/etc.).
- Assign client and line items.
- System cron endpoint generates invoices from due templates.

Operational notes:

- Automatic generation is handled by `/api/cron/generate-recurring`.
- Ensure server cron uses valid `Authorization: Bearer <CRON_SECRET>`.

## 8. Multi-language and RTL

SheetInvoicer supports locale handling and translation messages.

- Locale API: `/api/locale`
- Translation resources: `messages/`

For RTL languages:

- Ensure the selected locale is configured for RTL rendering.
- Confirm layout and spacing in invoice preview and portal pages.

## 9. Payments and Client Portal

- Clients can pay from `/pay/[id]`.
- Stripe Checkout is created through `/api/stripe/create-checkout`.
- Magic-link and invoice emails guide clients to portal/payment pages.
