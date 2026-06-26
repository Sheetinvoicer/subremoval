-- ============================================================================
-- SheetInvoicer — pending enterprise-invoicing migrations (consolidated bundle)
-- Generated: 2026-06-26T00:44:27.326Z
--
-- HOW TO APPLY: open the Supabase Dashboard -> SQL Editor, paste this ENTIRE
-- file, and click Run. Every statement is idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP ... IF EXISTS / DO-guarded policies), and each
-- source migration keeps its own BEGIN/COMMIT, so re-running is safe.
--
-- This bundle contains the 4 migrations that are NOT yet applied to project
-- ruljiaoqscjcvhocqjtq. 202606252240_add_recurring_invoice_exceptions.sql is
-- already applied and is deliberately NOT included.
--
-- This is a convenience copy; the authoritative files remain under
-- supabase/migrations/. Do NOT add this bundle to the migration history.
-- ============================================================================


-- >>> BEGIN 202606251857_add_invoice_list_facets.sql ==============================

-- Enterprise invoice list: filter facets, denormalized sort/search columns and
-- the indexes that let the list page push filtering/sorting/pagination into
-- Postgres instead of loading every row into the browser.
--
-- `tags`/`metadata` are lightweight attributes of an already-RLS'd invoice row
-- (not relational entities), so they live as GIN-indexed columns here.
-- `client_name`/`project_name` are denormalized because PostgREST cannot
-- `.order()` or OR-search across embedded relations; they are kept in sync by
-- triggers below (mirroring how `recurring_invoices`/`estimates` already store
-- `client_name`). `updated_at` powers the "last updated" sort.

begin;

alter table public.invoices
  add column if not exists tags text[] not null default '{}',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists client_name text,
  add column if not exists project_name text;

-- Backfill the denormalized names for existing rows (runs as the migration role,
-- so it is not constrained by RLS and fixes every user's invoices at once).
update public.invoices i
  set client_name = c.name
  from public.clients c
  where i.client_id = c.id
    and (i.client_name is null or i.client_name is distinct from c.name);

update public.invoices i
  set project_name = p.name
  from public.projects p
  where i.project_id = p.id
    and (i.project_name is null or i.project_name is distinct from p.name);

-- Indexes powering the common filter/sort combinations.
create index if not exists idx_invoices_tags on public.invoices using gin (tags);
create index if not exists idx_invoices_metadata on public.invoices using gin (metadata);
create index if not exists idx_invoices_client_name on public.invoices (user_id, client_name);
create index if not exists idx_invoices_user_status_due_total
  on public.invoices (user_id, status, due_date, total, updated_at desc);

-- Keep client_name/project_name (and updated_at) in sync whenever an invoice is
-- written. Scoped by user_id so a forged client_id pointing at another user's
-- client can never copy that client's name onto the row.
create or replace function public.sync_invoice_denormalized_fields()
returns trigger as $$
begin
  if new.client_id is not null then
    select name into new.client_name
      from public.clients
      where id = new.client_id and user_id = new.user_id;
  else
    new.client_name := null;
  end if;

  if new.project_id is not null then
    select name into new.project_name
      from public.projects
      where id = new.project_id and user_id = new.user_id;
  else
    new.project_name := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists invoices_sync_denormalized_fields on public.invoices;
create trigger invoices_sync_denormalized_fields
  before insert or update on public.invoices
  for each row
  execute function public.sync_invoice_denormalized_fields();

-- Propagate client/project renames onto their invoices so the denormalized
-- columns never go stale.
create or replace function public.propagate_client_name_to_invoices()
returns trigger as $$
begin
  update public.invoices
    set client_name = new.name
    where client_id = new.id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_propagate_name on public.clients;
create trigger clients_propagate_name
  after update of name on public.clients
  for each row
  when (old.name is distinct from new.name)
  execute function public.propagate_client_name_to_invoices();

create or replace function public.propagate_project_name_to_invoices()
returns trigger as $$
begin
  update public.invoices
    set project_name = new.name
    where project_id = new.id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_propagate_name on public.projects;
create trigger projects_propagate_name
  after update of name on public.projects
  for each row
  when (old.name is distinct from new.name)
  execute function public.propagate_project_name_to_invoices();

commit;

-- <<< END 202606251857_add_invoice_list_facets.sql


-- >>> BEGIN 202606252036_add_invoice_payments_and_history.sql =====================

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

-- <<< END 202606252036_add_invoice_payments_and_history.sql


-- >>> BEGIN 202606252110_add_invoice_comments_and_share_links.sql =================

-- Enterprise invoice detail (Step 4): threaded internal comments and
-- time-limited public share links.
--
-- `invoice_comments` is an owner-scoped, optionally-threaded discussion log for
-- an invoice (the detail page renders it; the public share page never does).
-- The `audience` column (team|client) is kept for forward-compat with a future
-- client-visible thread, but this phase treats every comment as internal.
--
-- `invoice_share_links` issues an unguessable token that the public, service-role
-- route (`app/api/public/invoice/[token]/route.ts`) resolves to a sanitized,
-- read-only invoice. Links can carry an expiry and be revoked; aggregate view
-- analytics (`view_count`/`last_viewed_at`) are bumped atomically via the
-- `increment_invoice_share_view` SECURITY DEFINER function so the service-role
-- route never has to read-modify-write.
--
-- Both tables carry owner-scoped RLS (auth.uid() = user_id) created with the
-- project's DO-guarded idempotent pattern (mirroring
-- 202606252036_add_invoice_payments_and_history.sql).

begin;

-- Threaded internal comments. Owner-scoped and fully manageable by the owner.
create table if not exists public.invoice_comments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.invoice_comments(id) on delete cascade,
  audience text not null default 'team' check (audience in ('team', 'client')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_comments_invoice_id on public.invoice_comments(invoice_id);
create index if not exists idx_invoice_comments_user_invoice on public.invoice_comments(user_id, invoice_id);
create index if not exists idx_invoice_comments_invoice_created_at on public.invoice_comments(invoice_id, created_at);
create index if not exists idx_invoice_comments_parent_id on public.invoice_comments(parent_id);

-- Time-limited public share links. Owner-scoped; resolved publicly only through
-- the service-role route, which bypasses RLS to read by token.
create table if not exists public.invoice_share_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_share_links_invoice_id on public.invoice_share_links(invoice_id);
create index if not exists idx_invoice_share_links_user_invoice on public.invoice_share_links(user_id, invoice_id);

alter table public.invoice_comments enable row level security;
alter table public.invoice_share_links enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_comments'
      and policyname = 'Users can manage own invoice comments'
  ) then
    create policy "Users can manage own invoice comments"
      on public.invoice_comments
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_share_links'
      and policyname = 'Users can manage own invoice share links'
  ) then
    create policy "Users can manage own invoice share links"
      on public.invoice_share_links
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Atomically bump aggregate view analytics for an *active* (not revoked, not
-- expired) share link. SECURITY DEFINER so the service-role public route can
-- record a view in a single statement (no read-modify-write race), mirroring
-- the SECURITY DEFINER helpers in 202606202200_add_user_roles.sql.
create or replace function public.increment_invoice_share_view(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.invoice_share_links
     set view_count = view_count + 1,
         last_viewed_at = now()
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now());
$$;

commit;

-- <<< END 202606252110_add_invoice_comments_and_share_links.sql


-- >>> BEGIN 202606252150_add_invoice_drafts.sql ===================================

-- Enterprise invoice editor (Step 5 — authoring core): versioned auto-save drafts.
--
-- `invoice_drafts` stores point-in-time snapshots of the invoice editor's form
-- state so an in-progress invoice can be auto-saved server-side (in addition to
-- the browser's localStorage) and restored later — including for brand-new
-- invoices that have no `invoices` row yet.
--
-- Versions are append-only rows grouped by `(user_id, draft_key)`:
--   * editing an existing invoice -> draft_key = the invoice id (and invoice_id
--     is set, so the draft is cascade-deleted with the invoice);
--   * creating a new invoice       -> draft_key = 'new' (invoice_id is null).
-- The drafts API computes the next `version` as max(version)+1 for the key and
-- caps the number of retained versions; the editor clears the draft on a
-- successful save.
--
-- Owner-scoped RLS (auth.uid() = user_id) created with the project's DO-guarded
-- idempotent pattern (mirroring 202606252036_add_invoice_payments_and_history.sql).

begin;

create table if not exists public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Set when editing an existing invoice so the draft is cleaned up with it;
  -- null for a not-yet-created ("new") invoice draft.
  invoice_id uuid references public.invoices(id) on delete cascade,
  -- Stable grouping key per editor target: the invoice id, or 'new'.
  draft_key text not null,
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_drafts_user_key
  on public.invoice_drafts(user_id, draft_key, version desc);
create index if not exists idx_invoice_drafts_invoice_id
  on public.invoice_drafts(invoice_id);

alter table public.invoice_drafts enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_drafts'
      and policyname = 'Users can manage own invoice drafts'
  ) then
    create policy "Users can manage own invoice drafts"
      on public.invoice_drafts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

commit;

-- <<< END 202606252150_add_invoice_drafts.sql

