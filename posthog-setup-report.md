<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into SheetInvoicer. The integration covers client-side initialization via `instrumentation-client.js`, a reverse proxy via Next.js rewrites in `next.config.js`, a reusable server-side PostHog client at `lib/posthog-server.js`, and event captures + user identification across all key user flows. Errors are tracked via `posthog.captureException` throughout auth and invoice flows. Server-side events are captured in the Stripe webhook handler for subscription lifecycle events.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User created a new account via email/password form | `app/signup/page.js` |
| `user_logged_in` | User signed in via email/password form | `app/login/page.js` |
| `user_logged_in_with_google` | User signed in or signed up via Google OAuth | `app/login/page.js` |
| `password_reset_requested` | User requested a password reset link | `app/login/page.js` |
| `invoice_created` | User created invoices in bulk via CSV upload wizard | `app/dashboard/invoices/new/page.js` |
| `invoice_status_updated` | User manually updated invoice status | `app/dashboard/invoices/[id]/page.js` |
| `invoice_deleted` | User deleted an invoice | `app/dashboard/invoices/[id]/page.js` |
| `invoice_email_sent` | User sent invoice via email to their client | `app/dashboard/invoices/[id]/page.js` |
| `invoice_payment_initiated` | User initiated a Stripe checkout session | `app/dashboard/invoices/[id]/page.js` |
| `invoice_refund_initiated` | User initiated a refund for a paid invoice | `app/dashboard/invoices/[id]/page.js` |
| `client_created` | User added a new client | `app/dashboard/clients/page.js` |
| `client_updated` | User edited an existing client's information | `app/dashboard/clients/page.js` |
| `client_deleted` | User deleted a client | `app/dashboard/clients/page.js` |
| `subscription_checkout_completed` | Stripe webhook: user upgraded to a paid plan | `app/api/stripe/webhook/route.js` |
| `subscription_canceled` | Stripe webhook: subscription was canceled | `app/api/stripe/webhook/route.js` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/450376/dashboard/1656927)
- [New signups & logins over time](https://us.posthog.com/project/450376/insights/RTTaxmW5)
- [Invoice creation funnel](https://us.posthog.com/project/450376/insights/MB7rN0TB)
- [Invoice actions over time](https://us.posthog.com/project/450376/insights/35cO6e94)
- [Client management activity](https://us.posthog.com/project/450376/insights/yJhse0Ui)
- [Subscription & churn events](https://us.posthog.com/project/450376/insights/tGwISr6z)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
