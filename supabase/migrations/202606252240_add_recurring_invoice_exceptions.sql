begin;

-- Step 5b: per-schedule "skip dates" for recurring invoices.
--
-- The recurring generator (app/api/cron/generate-recurring) skips creating an
-- invoice when a due schedule's `next_date` matches one of these ISO
-- (YYYY-MM-DD) dates, while still advancing `next_date` so the schedule is
-- never stuck on a skipped occurrence. Defaults to an empty array so existing
-- rows and the flat-amount model keep working unchanged.
alter table public.recurring_invoices
  add column if not exists exceptions jsonb not null default '[]'::jsonb;

commit;
