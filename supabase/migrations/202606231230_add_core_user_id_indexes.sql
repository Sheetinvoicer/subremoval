-- Performance: add missing indexes on the columns every dashboard page filters
-- and sorts by. The core tables (invoices, clients, expenses, subscriptions) are
-- queried on almost every page with `where user_id = ...`, but had no index on
-- user_id, forcing sequential scans that grow linearly with table size.
--
-- All statements are idempotent (IF NOT EXISTS) and guarded so this migration is
-- safe to run repeatedly and against environments where a table may not exist.

-- Invoices: filtered by user_id, often sorted by created_at / due_date and
-- filtered by status. A composite (user_id, created_at) index serves the common
-- "my invoices, newest first" query directly.
CREATE INDEX IF NOT EXISTS idx_invoices_user_id
  ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_created_at
  ON public.invoices (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id_status
  ON public.invoices (user_id, status);

-- Clients: filtered by user_id on every clients/dashboard query.
CREATE INDEX IF NOT EXISTS idx_clients_user_id
  ON public.clients (user_id);

-- Expenses: filtered by user_id on dashboard + expenses pages.
CREATE INDEX IF NOT EXISTS idx_expenses_user_id
  ON public.expenses (user_id);

-- Subscriptions: looked up by user_id from the sidebar and subscription page.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);
