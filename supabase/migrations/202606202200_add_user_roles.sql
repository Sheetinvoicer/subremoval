-- Role-aware user profiles.
--
-- NOTE: this migration originally assumed a pre-existing `public.users` table and
-- used `create policy if not exists`, which is invalid PostgreSQL and caused the
-- migration to abort. It now creates the table if needed and uses DO-guarded
-- policy creation so it is idempotent and valid.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists role text not null default 'viewer';

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in ('admin', 'staff', 'viewer'));

alter table public.users enable row level security;

-- SECURITY DEFINER helper avoids infinite recursion when a policy ON public.users
-- needs to check whether the current user is an admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Users can view own row') then
    create policy "Users can view own row" on public.users
      for select to authenticated using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Admins can view all users') then
    create policy "Admins can view all users" on public.users
      for select to authenticated using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Admins can update user roles') then
    create policy "Admins can update user roles" on public.users
      for update to authenticated
      using (public.is_admin())
      with check (role in ('admin', 'staff', 'viewer'));
  end if;
end $$;
