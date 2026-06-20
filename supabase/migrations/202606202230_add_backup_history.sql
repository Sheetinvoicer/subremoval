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

create policy if not exists "Admins can read backup history"
on public.backup_history
for select
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.role = 'admin'
  )
);

create policy if not exists "Admins can modify backup history"
on public.backup_history
for all
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.role = 'admin'
  )
);
