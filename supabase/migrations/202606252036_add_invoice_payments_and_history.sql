-- Enterprise invoice detail: partial-payment tracking and an owner-visible
-- change/history log.
--
-- `invoice_payments` records partial payments / credits / adjustments against an
-- invoice; the detail page sums them into a running balance and the payments API
-- auto-marks the invoice `paid` once it is settled. `invoice_history` is an
-- append-only, owner-readable audit trail of high-value actions (payments,
-- status changes); high-value actions are *additionally* mirrored to the
-- admin-only `audit_logs` via lib/audit/log.js. Both tables carry owner-scoped
-- RLS (auth.uid() = user_id) created with the project's DO-guarded idempotent
-- pattern (mirroring 202606202345_add_time_entries.sql / 202606242036_add_audit_logs.sql).

begin;

-- Partial payments / credits / adjustments. Owner-scoped, fully manageable by
-- the owner (corrections are made by adding credit/adjustment rows, but owners
-- may also delete a mistaken entry).
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  kind text not null default 'payment' check (kind in ('payment', 'credit', 'adjustment')),
  paid_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice_id on public.invoice_payments(invoice_id);
create index if not exists idx_invoice_payments_user_invoice on public.invoice_payments(user_id, invoice_id);
create index if not exists idx_invoice_payments_invoice_paid_at on public.invoice_payments(invoice_id, paid_at desc);

-- Append-only history log. Owner-readable + owner-insertable only (no update or
-- delete policy) so the trail cannot be silently rewritten.
create table if not exists public.invoice_history (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_history_invoice_id on public.invoice_history(invoice_id);
create index if not exists idx_invoice_history_invoice_created_at on public.invoice_history(invoice_id, created_at desc);

alter table public.invoice_payments enable row level security;
alter table public.invoice_history enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_payments'
      and policyname = 'Users can manage own invoice payments'
  ) then
    create policy "Users can manage own invoice payments"
      on public.invoice_payments
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_history'
      and policyname = 'Users can read own invoice history'
  ) then
    create policy "Users can read own invoice history"
      on public.invoice_history
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_history'
      and policyname = 'Users can append own invoice history'
  ) then
    create policy "Users can append own invoice history"
      on public.invoice_history
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- The detail page now lets users set the full status lifecycle
-- (draft, sent, viewed, paid, overdue, disputed, cancelled). The invoices table
-- predates these migrations and has no status CHECK here, but defensively drop
-- any legacy CHECK constraint that references `status` so the expanded set can
-- never be rejected at runtime. This is a no-op when no such constraint exists.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.invoices drop constraint %I', c.conname);
  end loop;
end $$;

commit;
