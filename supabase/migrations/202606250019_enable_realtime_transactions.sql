-- Enable Supabase Realtime for public.transactions.
--
-- The bank dashboard's live feed (components/RealtimeBank.tsx) subscribes to
-- postgres_changes on this table, so it must belong to the `supabase_realtime`
-- publication. Without this, webhook-driven sync + auto-reconciliation updates
-- never reach the browser in real time.
--
-- Fully idempotent (safe to run repeatedly) and a no-op on databases that do not
-- have the Supabase realtime publication.

begin;

-- Full row images so UPDATE/DELETE realtime payloads carry every column.
alter table public.transactions replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'transactions'
    ) then
      alter publication supabase_realtime add table public.transactions;
    end if;
  end if;
end $$;

commit;
