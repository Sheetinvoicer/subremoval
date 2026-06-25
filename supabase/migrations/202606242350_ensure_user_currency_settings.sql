-- Ensure the per-user currency-preference table exists and is RLS-protected.
--
-- Background:
--   The app (currency settings page + smart currency/tax detection) reads and
--   upserts `public.user_currency_settings`, but no migration in the repo ever
--   created it. This migration creates it if missing and adds optional columns
--   used to remember the user's smart-detection preferences (tax rate, detected
--   country/type, and whether auto-detection is enabled). Day-to-day preferences
--   are also cached client-side in localStorage; this table provides durable,
--   cross-device persistence for the chosen default currency.
--
-- Fully idempotent (safe to run repeatedly).

begin;

create table if not exists public.user_currency_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  default_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Optional columns for remembering smart currency/tax detection preferences.
alter table public.user_currency_settings
  add column if not exists preferred_tax_rate numeric;
alter table public.user_currency_settings
  add column if not exists tax_country text;
alter table public.user_currency_settings
  add column if not exists tax_type text;
alter table public.user_currency_settings
  add column if not exists auto_detect_location boolean not null default true;

create index if not exists user_currency_settings_user_id_idx
  on public.user_currency_settings (user_id);

alter table public.user_currency_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_currency_settings'
      and policyname = 'Users can select own currency settings'
  ) then
    create policy "Users can select own currency settings"
      on public.user_currency_settings
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_currency_settings'
      and policyname = 'Users can insert own currency settings'
  ) then
    create policy "Users can insert own currency settings"
      on public.user_currency_settings
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_currency_settings'
      and policyname = 'Users can update own currency settings'
  ) then
    create policy "Users can update own currency settings"
      on public.user_currency_settings
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_currency_settings'
      and policyname = 'Users can delete own currency settings'
  ) then
    create policy "Users can delete own currency settings"
      on public.user_currency_settings
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

commit;
