-- Enterprise invoice editor (Step 5 — authoring core): versioned auto-save drafts.
--
-- `invoice_drafts` stores point-in-time snapshots of the invoice editor's form
-- state so an in-progress invoice can be auto-saved server-side (in addition to
-- the browser's localStorage) and restored later — including for brand-new
-- invoices that have no `invoices` row yet.
--
-- Versions are append-only rows grouped by `(user_id, draft_key)`:
--   * editing an existing invoice -> draft_key = the invoice id (and invoice_id
--     is set, so the draft is cascade-deleted with the invoice);
--   * creating a new invoice       -> draft_key = 'new' (invoice_id is null).
-- The drafts API computes the next `version` as max(version)+1 for the key and
-- caps the number of retained versions; the editor clears the draft on a
-- successful save.
--
-- Owner-scoped RLS (auth.uid() = user_id) created with the project's DO-guarded
-- idempotent pattern (mirroring 202606252036_add_invoice_payments_and_history.sql).

begin;

create table if not exists public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Set when editing an existing invoice so the draft is cleaned up with it;
  -- null for a not-yet-created ("new") invoice draft.
  invoice_id uuid references public.invoices(id) on delete cascade,
  -- Stable grouping key per editor target: the invoice id, or 'new'.
  draft_key text not null,
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_drafts_user_key
  on public.invoice_drafts(user_id, draft_key, version desc);
create index if not exists idx_invoice_drafts_invoice_id
  on public.invoice_drafts(invoice_id);

alter table public.invoice_drafts enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_drafts'
      and policyname = 'Users can manage own invoice drafts'
  ) then
    create policy "Users can manage own invoice drafts"
      on public.invoice_drafts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

commit;
