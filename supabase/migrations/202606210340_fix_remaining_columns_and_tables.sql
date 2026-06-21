begin;

alter table public.invoices
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists currency text default 'USD';

alter table public.clients
  add column if not exists company text;

alter table public.expenses
  add column if not exists currency text default 'USD';

alter table public.time_entries
  add column if not exists duration_minutes integer default 0,
  add column if not exists entry_date date default current_date;

alter table public.user_settings
  add column if not exists default_currency text default 'USD',
  add column if not exists notifications_enabled boolean default true;

create table if not exists public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text,
  client_name text,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  frequency text not null default 'monthly' check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  notes text,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  estimate_number text,
  client_name text,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'converted')),
  notes text,
  valid_until date,
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_invoices_user_id_idx on public.recurring_invoices(user_id);
create index if not exists recurring_invoices_client_id_idx on public.recurring_invoices(client_id);
create index if not exists recurring_invoices_next_date_idx on public.recurring_invoices(next_date);

create index if not exists estimates_user_id_idx on public.estimates(user_id);
create index if not exists estimates_client_id_idx on public.estimates(client_id);

commit;