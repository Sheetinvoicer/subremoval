-- Entity: a human-in-the-loop AI operations layer.
--
-- Stores the Commander's command history, every proposed action (with its
-- approval/rollback lifecycle), and entity settings (e.g. the emergency stop).
--
-- Rows are written by trusted server code using the Supabase service-role key
-- (see lib/entity/supabase-store.ts), so no INSERT/UPDATE policy is exposed to
-- authenticated users. Reads are restricted to admins via the existing
-- public.is_admin() SECURITY DEFINER helper (see 202606202200_add_user_roles.sql),
-- mirroring the audit_logs and backup_history tables. The immutable audit trail
-- itself reuses public.audit_logs.

create table if not exists public.entity_commands (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  summary text,
  plan jsonb not null default '{}'::jsonb,
  status text not null default 'planned',
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entity_actions (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  type text not null,
  title text not null,
  summary text,
  -- safe | medium | high
  permission text not null default 'high',
  -- pending | approved | rejected | executed | failed | rolled_back
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_by_email text,
  -- snapshot captured at execution time so the action can be reverted
  rollback_state jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entity_settings (
  key text primary key,
  value text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists entity_commands_created_at_idx on public.entity_commands (created_at desc);
create index if not exists entity_actions_created_at_idx on public.entity_actions (created_at desc);
create index if not exists entity_actions_status_idx on public.entity_actions (status);
create index if not exists entity_actions_module_idx on public.entity_actions (module);

alter table public.entity_commands enable row level security;
alter table public.entity_actions enable row level security;
alter table public.entity_settings enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entity_commands' and policyname = 'Admins can read entity commands') then
    create policy "Admins can read entity commands" on public.entity_commands
      for select to authenticated using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entity_actions' and policyname = 'Admins can read entity actions') then
    create policy "Admins can read entity actions" on public.entity_actions
      for select to authenticated using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entity_settings' and policyname = 'Admins can read entity settings') then
    create policy "Admins can read entity settings" on public.entity_settings
      for select to authenticated using (public.is_admin());
  end if;
end $$;
