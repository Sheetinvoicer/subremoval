begin;

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  default_currency text not null default 'USD',
  language text not null default 'en',
  theme text not null default 'system',
  notifications boolean not null default true,
  notifications_enabled boolean not null default true,
  company_name text,
  company_email text,
  company_phone text,
  company_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'planning' check (status in ('planning', 'active', 'on_hold', 'completed', 'archived')),
  budget numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  date date not null default now()::date,
  entry_date date not null default now()::date,
  hours numeric(10,2),
  duration_minutes integer,
  description text not null,
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_hours_positive check (hours is null or hours > 0),
  constraint time_entries_duration_minutes_positive check (duration_minutes is null or duration_minutes > 0)
);

alter table public.invoices
  add column project_id uuid references public.projects(id) on delete set null;

create index user_settings_user_id_idx on public.user_settings(user_id);

create index projects_user_id_idx on public.projects(user_id);
create index projects_client_id_idx on public.projects(client_id);

create index time_entries_user_id_idx on public.time_entries(user_id);
create index time_entries_client_id_idx on public.time_entries(client_id);
create index time_entries_invoice_id_idx on public.time_entries(invoice_id);
create index time_entries_project_id_idx on public.time_entries(project_id);

create index invoices_project_id_idx on public.invoices(project_id);

create or replace function public.sync_user_settings_columns()
returns trigger as $$
begin
  if new.currency is null and new.default_currency is not null then
    new.currency := new.default_currency;
  end if;
  if new.default_currency is null and new.currency is not null then
    new.default_currency := new.currency;
  end if;
  if new.notifications is null and new.notifications_enabled is not null then
    new.notifications := new.notifications_enabled;
  end if;
  if new.notifications_enabled is null and new.notifications is not null then
    new.notifications_enabled := new.notifications;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function public.sync_time_entries_columns()
returns trigger as $$
begin
  if new.entry_date is null and new.date is not null then
    new.entry_date := new.date;
  end if;
  if new.date is null and new.entry_date is not null then
    new.date := new.entry_date;
  end if;

  if new.duration_minutes is null and new.hours is not null then
    new.duration_minutes := round(new.hours * 60)::integer;
  end if;
  if new.hours is null and new.duration_minutes is not null then
    new.hours := round((new.duration_minutes::numeric / 60.0), 2);
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function public.set_projects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_settings_sync_before_write
before insert or update on public.user_settings
for each row
execute function public.sync_user_settings_columns();

create trigger time_entries_sync_before_write
before insert or update on public.time_entries
for each row
execute function public.sync_time_entries_columns();

create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_projects_updated_at();

alter table public.user_settings enable row level security;
alter table public.projects enable row level security;
alter table public.time_entries enable row level security;

create policy "Users can select own settings"
  on public.user_settings
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own settings"
  on public.user_settings
  for delete
  using (auth.uid() = user_id);

create policy "Users can select own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects
  for delete
  using (auth.uid() = user_id);

create policy "Users can select own time entries"
  on public.time_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own time entries"
  on public.time_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own time entries"
  on public.time_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own time entries"
  on public.time_entries
  for delete
  using (auth.uid() = user_id);

commit;