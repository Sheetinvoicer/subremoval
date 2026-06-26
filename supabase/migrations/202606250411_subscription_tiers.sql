-- ===========================================================================
-- Subscription plan overhaul: four-tier model (Free, Pro, Business, Enterprise)
--
-- This migration is idempotent and additive. It does NOT delete rows or
-- downgrade active paid subscribers. It:
--   1. Normalizes existing subscriptions.plan values to canonical tier names
--      and constrains the column to the four valid tiers.
--   2. Backfills a Free subscription row for every user that lacks one so
--      feature gating works retroactively.
--   3. Adds a plan_limits table + BEFORE INSERT triggers that enforce the Free
--      tier's 5-item caps on invoices/clients/expenses at the database level
--      (the authoritative boundary; app checks are pre-flight only).
--   4. Adds team_members (seats) and sso_connections tables for the
--      Business/Enterprise features, with RLS and seat-limit enforcement.
--
-- The Free caps mirror lib/subscriptions/plans.js; a Jest test asserts parity.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Normalize + constrain subscriptions.plan
-- ---------------------------------------------------------------------------
update public.subscriptions set plan = 'Free' where plan is null or btrim(plan) = '';

-- Canonical capitalization for known tiers (e.g. 'business' -> 'Business').
update public.subscriptions
  set plan = initcap(lower(plan))
  where lower(plan) in ('free', 'pro', 'business', 'enterprise')
    and plan <> initcap(lower(plan));

-- Any unrecognized legacy value falls back to Free (never a paid tier).
update public.subscriptions
  set plan = 'Free'
  where plan not in ('Free', 'Pro', 'Business', 'Enterprise');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_plan_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_plan_check
      check (plan in ('Free', 'Pro', 'Business', 'Enterprise')) not valid;
    alter table public.subscriptions validate constraint subscriptions_plan_check;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill a Free subscription row for every user without one
-- ---------------------------------------------------------------------------
insert into public.subscriptions (user_id, plan, status)
select u.id, 'Free', null
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Plan limits + enforcement triggers
--    Only finite caps are stored; the absence of a row means "unlimited".
-- ---------------------------------------------------------------------------
create table if not exists public.plan_limits (
  plan text not null,
  resource text not null,
  max_count integer not null,
  primary key (plan, resource)
);

insert into public.plan_limits (plan, resource, max_count) values
  ('Free', 'invoices', 5),
  ('Free', 'clients', 5),
  ('Free', 'expenses', 5),
  ('Free', 'teamMembers', 1),
  ('Pro', 'teamMembers', 1),
  ('Business', 'teamMembers', 5)
on conflict (plan, resource) do update set max_count = excluded.max_count;

-- Generic per-row enforcement for count-limited resources. The resource key is
-- passed as a trigger argument; the table to count is TG_TABLE_NAME.
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resource text := tg_argv[0];
  v_plan text;
  v_limit integer;
  v_count bigint;
begin
  select coalesce(s.plan, 'Free') into v_plan
  from public.subscriptions s
  where s.user_id = new.user_id;

  if v_plan is null then
    v_plan := 'Free';
  end if;

  select pl.max_count into v_limit
  from public.plan_limits pl
  where pl.plan = v_plan and pl.resource = v_resource;

  -- No configured limit => unlimited for this plan/resource.
  if v_limit is null then
    return new;
  end if;

  execute format('select count(*) from public.%I where user_id = $1', tg_table_name)
    into v_count
    using new.user_id;

  if v_count >= v_limit then
    raise exception
      'PLAN_LIMIT_EXCEEDED: % limit reached for the % plan (max %)', v_resource, v_plan, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_invoice_limit on public.invoices;
create trigger trg_enforce_invoice_limit
  before insert on public.invoices
  for each row execute function public.enforce_plan_limit('invoices');

drop trigger if exists trg_enforce_client_limit on public.clients;
create trigger trg_enforce_client_limit
  before insert on public.clients
  for each row execute function public.enforce_plan_limit('clients');

drop trigger if exists trg_enforce_expense_limit on public.expenses;
create trigger trg_enforce_expense_limit
  before insert on public.expenses
  for each row execute function public.enforce_plan_limit('expenses');

-- ---------------------------------------------------------------------------
-- 4. Team members (seats) — Business (5) / Enterprise (unlimited)
-- ---------------------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  member_email text not null,
  role text not null default 'member' check (role in ('member', 'admin', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_team_members_owner_email
  on public.team_members (owner_id, lower(member_email));
create index if not exists idx_team_members_owner on public.team_members (owner_id);
create index if not exists idx_team_members_member_user on public.team_members (member_user_id);

alter table public.team_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'Owners manage their team') then
    create policy "Owners manage their team" on public.team_members
      for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'Members can view their membership') then
    create policy "Members can view their membership" on public.team_members
      for select using (auth.uid() = member_user_id);
  end if;
end $$;

-- The owner occupies one seat, so invitable members = teamMembers limit - 1.
create or replace function public.enforce_team_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_count bigint;
begin
  select coalesce(s.plan, 'Free') into v_plan
  from public.subscriptions s
  where s.user_id = new.owner_id;

  if v_plan is null then
    v_plan := 'Free';
  end if;

  select pl.max_count into v_limit
  from public.plan_limits pl
  where pl.plan = v_plan and pl.resource = 'teamMembers';

  -- Unlimited seats (Enterprise has no row).
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.team_members
  where owner_id = new.owner_id and status <> 'revoked';

  if v_count >= greatest(v_limit - 1, 0) then
    raise exception
      'PLAN_LIMIT_EXCEEDED: team seat limit reached for the % plan (max %)', v_plan, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_team_seat_limit on public.team_members;
create trigger trg_enforce_team_seat_limit
  before insert on public.team_members
  for each row execute function public.enforce_team_seat_limit();

-- ---------------------------------------------------------------------------
-- 5. SSO connections — Business / Enterprise (app records the registered
--    domain; actual identity-provider provisioning is done in Supabase Auth).
-- ---------------------------------------------------------------------------
create table if not exists public.sso_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  provider_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_sso_connections_domain
  on public.sso_connections (lower(domain));
create index if not exists idx_sso_connections_owner on public.sso_connections (owner_id);

alter table public.sso_connections enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sso_connections' and policyname = 'Owners manage their SSO connections') then
    create policy "Owners manage their SSO connections" on public.sso_connections
      for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
end $$;
