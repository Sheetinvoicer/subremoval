begin;

-- Persist the accounting export field-mapping per user so it survives across
-- devices/sessions instead of living only in browser localStorage.
alter table public.user_settings
  add column if not exists accounting_mapping jsonb;

commit;
