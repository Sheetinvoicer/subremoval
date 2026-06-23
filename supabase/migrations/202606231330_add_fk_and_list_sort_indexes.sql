-- Performance: add the remaining foreign-key and list sort/filter indexes that
-- the core index migration (202606231230) did not cover. These back the joins
-- and the "newest first" / status-filtered queries used by the invoices,
-- estimates, expenses and recurring-invoices list pages.
--
-- Every statement is fully guarded: each index is only created when its table
-- AND column actually exist, so this migration is safe to run repeatedly and
-- against environments whose schema differs slightly. CREATE INDEX
-- CONCURRENTLY is intentionally avoided so the whole file runs in one
-- transaction without manual intervention.

DO $$
BEGIN
  -- invoices.client_id: the invoices list embeds clients(name). Without this
  -- index that join degrades to a sequential scan as the table grows.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'client_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id)';
  END IF;

  -- estimates: filtered by user_id and sorted newest-first on the list page.
  -- (user_id / client_id are already indexed by an earlier migration.)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_estimates_user_id_created_at ON public.estimates (user_id, created_at DESC)';
  END IF;

  -- estimates.status: used by the status filter tabs.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates (status)';
  END IF;

  -- expenses: dashboard + expenses page filter by user_id and order by date.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_expenses_user_id_created_at ON public.expenses (user_id, created_at DESC)';
  END IF;

  -- recurring_invoices.status: filtered on the recurring page (active/paused).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recurring_invoices' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_recurring_invoices_status ON public.recurring_invoices (status)';
  END IF;
END $$;
