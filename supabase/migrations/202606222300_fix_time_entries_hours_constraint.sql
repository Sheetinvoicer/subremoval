begin;

-- Ensure both hours and duration_minutes columns exist and are consistent.
alter table public.time_entries
  add column if not exists hours numeric(10, 2),
  add column if not exists duration_minutes integer;

-- Make hours nullable so inserts that only provide duration_minutes do not fail.
alter table public.time_entries
  alter column hours drop not null;

-- Replace any strict positive-only constraint with one that tolerates nulls.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'time_entries_hours_positive'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries drop constraint time_entries_hours_positive;
  end if;
end $$;

alter table public.time_entries
  add constraint time_entries_hours_positive check (hours is null or hours > 0);

-- Keep hours and duration_minutes in sync on write.
create or replace function public.sync_time_entries_columns()
returns trigger as $$
begin
  if new.duration_minutes is null and new.hours is not null then
    new.duration_minutes := round(new.hours * 60)::integer;
  end if;
  if new.hours is null and new.duration_minutes is not null then
    new.hours := round((new.duration_minutes::numeric / 60.0), 2);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists time_entries_sync_before_write on public.time_entries;
create trigger time_entries_sync_before_write
before insert or update on public.time_entries
for each row
execute function public.sync_time_entries_columns();

commit;
