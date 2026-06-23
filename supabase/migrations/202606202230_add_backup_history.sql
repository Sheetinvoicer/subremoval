create table if not exists public.backup_history (
  id uuid primary key default gen_random_uuid(),
  backup_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  snapshot_tables text[] not null,
  status text not null default 'completed' check (status in ('completed', 'failed', 'restored')),
  triggered_by text not null check (triggered_by in ('cron', 'manual')),
  size_bytes bigint,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  restored_at timestamptz
);

create index if not exists backup_history_created_at_idx on public.backup_history (created_at desc);

alter table public.backup_history enable row level security;

-- NOTE: originally used `create policy if not exists` (invalid PostgreSQL),
-- which aborted this migration. Replaced with DO-guarded creation that relies on
-- the public.is_admin() helper to avoid duplicating the admin lookup.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'backup_history' and policyname = 'Admins can read backup history') then
    create policy "Admins can read backup history" on public.backup_history
      for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'backup_history' and policyname = 'Admins can modify backup history') then
    create policy "Admins can modify backup history" on public.backup_history
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
