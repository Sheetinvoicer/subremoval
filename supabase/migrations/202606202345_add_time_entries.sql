create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  entry_date date not null default now()::date,
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_entries_user_id on public.time_entries(user_id);
create index if not exists idx_time_entries_invoice_id on public.time_entries(invoice_id);
create index if not exists idx_time_entries_entry_date on public.time_entries(entry_date);

alter table public.time_entries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'time_entries'
      and policyname = 'Users can manage own time entries'
  ) then
    create policy "Users can manage own time entries"
      on public.time_entries
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
