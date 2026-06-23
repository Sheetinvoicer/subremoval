-- Bootstrap the project owner as an admin.
--
-- Background / root cause:
--   `202606231300_fix_missing_tables_and_policies.sql` creates `public.users`,
--   backfills every existing user with role `viewer`, and the signup trigger
--   also defaults new users to `viewer`. As a result NO user ever has the
--   `admin` role, so `/dashboard/admin` (RoleGuard + proxy middleware) and the
--   `/api/admin/*` routes deny access to everyone — the admin page appears
--   "broken".
--
-- This migration promotes the designated owner email(s) to `admin` and makes
-- the signup trigger auto-promote those emails so the owner is always admin.
-- The app also enforces the same allowlist at runtime via `ADMIN_EMAILS`
-- (lib/auth/roles.js + proxy.ts); keep both in sync.
--
-- Fully idempotent (safe to run repeatedly).

begin;

-- 1. Promote any existing matching users to admin.
update public.users
set role = 'admin'
where lower(email) in ('f3027075@gmail.com');

-- 2. Recreate the signup handler so admin emails are inserted as admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case
      when lower(coalesce(new.email, '')) in ('f3027075@gmail.com') then 'admin'
      else 'viewer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
