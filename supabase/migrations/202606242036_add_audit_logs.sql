-- Full audit log: records user actions with timestamps for accountability.
--
-- Rows are written by trusted server code using the Supabase service-role key
-- (see lib/audit/log.js), so no INSERT policy is exposed to authenticated
-- users. Reads are restricted to admins via the existing public.is_admin()
-- SECURITY DEFINER helper (see 202606202200_add_user_roles.sql), mirroring the
-- backup_history table.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);

alter table public.audit_logs enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'Admins can read audit logs') then
    create policy "Admins can read audit logs" on public.audit_logs
      for select to authenticated using (public.is_admin());
  end if;
end $$;
