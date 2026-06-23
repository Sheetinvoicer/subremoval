-- Corrective migration: create tables that were never successfully created and
-- repair broken Row Level Security setup.
--
-- Background / root cause:
--   * Earlier migrations used `create policy if not exists`, which is NOT valid
--     PostgreSQL syntax, so `202606202200_add_user_roles.sql` and
--     `202606202230_add_backup_history.sql` aborted. As a result `public.users`,
--     `public.backup_history` were never created.
--   * `public.subscriptions` and `public.payments` were never created by any
--     migration at all, yet the app code references `subscriptions` heavily
--     (Sidebar, subscription page, Stripe webhooks, AI agent) and the issue
--     requires a `payments` table.
--   * `lib/auth/roles.js` reads `public.users(role)`; without that table every
--     admin route fails.
--
-- This migration is fully idempotent (safe to run repeatedly) and self-contained.

begin;

-- ---------------------------------------------------------------------------
-- 1. public.users (role-aware profile mirror of auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer',
  created_at timestamptz not null default now()
);

alter table public.users
  drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('admin', 'staff', 'viewer'));

alter table public.users enable row level security;

-- SECURITY DEFINER helper avoids the infinite-recursion problem of referencing
-- public.users from inside a policy ON public.users.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Users can view own row') then
    create policy "Users can view own row" on public.users
      for select to authenticated using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Admins can view all users') then
    create policy "Admins can view all users" on public.users
      for select to authenticated using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Admins can update user roles') then
    create policy "Admins can update user roles" on public.users
      for update to authenticated
      using (public.is_admin())
      with check (role in ('admin', 'staff', 'viewer'));
  end if;
end $$;

-- Keep public.users in sync with auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist in auth.users.
insert into public.users (id, email, role)
select id, email, 'viewer'
from auth.users
on conflict (id) do nothing;

create index if not exists idx_users_role on public.users (role);

-- ---------------------------------------------------------------------------
-- 2. public.subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'Free',
  status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  cancel_at_period_end boolean default false,
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One subscription row per user (upsert in lib/subscriptions/store.js matches by
-- user_id with .maybeSingle()).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_user_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_key unique (user_id);
  end if;
end $$;

create index if not exists idx_subscriptions_user_id
  on public.subscriptions (user_id);
create index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions (stripe_subscription_id);
create index if not exists idx_subscriptions_stripe_customer_id
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'Users can view own subscription') then
    create policy "Users can view own subscription" on public.subscriptions
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'Users can insert own subscription') then
    create policy "Users can insert own subscription" on public.subscriptions
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'Users can update own subscription') then
    create policy "Users can update own subscription" on public.subscriptions
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'Users can delete own subscription') then
    create policy "Users can delete own subscription" on public.subscriptions
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. public.payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  method text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_user_id on public.payments (user_id);
create index if not exists idx_payments_invoice_id on public.payments (invoice_id);
create index if not exists idx_payments_status on public.payments (status);

alter table public.payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'Users can view own payments') then
    create policy "Users can view own payments" on public.payments
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'Users can insert own payments') then
    create policy "Users can insert own payments" on public.payments
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'Users can update own payments') then
    create policy "Users can update own payments" on public.payments
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'Users can delete own payments') then
    create policy "Users can delete own payments" on public.payments
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. public.backup_history (admin-only)
-- ---------------------------------------------------------------------------
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

create index if not exists backup_history_created_at_idx
  on public.backup_history (created_at desc);

alter table public.backup_history enable row level security;

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

commit;
