-- Bank transaction feature (Stripe Connect):
--   * public.bank_connections – one row per connected Stripe account, so the app
--     can remember which connected account belongs to which user across reloads
--     instead of relying solely on the short-lived `stripe_connect_account` cookie.
--   * public.transactions – bank/balance transactions imported from Stripe, plus
--     the invoice they were matched to during reconciliation.
--
-- Fully idempotent (safe to run repeatedly) and self-contained.

begin;

-- ---------------------------------------------------------------------------
-- 1. public.bank_connections
-- ---------------------------------------------------------------------------
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_account_id text not null,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stripe_account_id)
);

create index if not exists bank_connections_user_id_idx on public.bank_connections(user_id);

alter table public.bank_connections enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bank_connections' and policyname = 'Users manage own bank connections') then
    create policy "Users manage own bank connections" on public.bank_connections
      for all to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. public.transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_transaction_id text not null,
  amount numeric not null default 0,
  currency text not null default 'usd',
  description text,
  type text,
  status text not null default 'available',
  transaction_date timestamptz not null default now(),
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stripe_transaction_id)
);

create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_date_idx on public.transactions(transaction_date desc);
create index if not exists transactions_matched_invoice_id_idx on public.transactions(matched_invoice_id);

alter table public.transactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'Users manage own transactions') then
    create policy "Users manage own transactions" on public.transactions
      for all to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_bank_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bank_connections_set_updated_at on public.bank_connections;
create trigger bank_connections_set_updated_at
before update on public.bank_connections
for each row
execute function public.set_bank_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_bank_updated_at();

commit;
