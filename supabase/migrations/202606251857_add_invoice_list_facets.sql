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
