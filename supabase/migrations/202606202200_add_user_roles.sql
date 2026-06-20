alter table public.users
add column if not exists role text not null default 'viewer';

alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check check (role in ('admin', 'staff', 'viewer'));

create policy if not exists "Users can view own row"
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy if not exists "Admins can view all users"
on public.users
for select
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.role = 'admin'
  )
);

create policy if not exists "Admins can update user roles"
on public.users
for update
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.role = 'admin'
  )
)
with check (
  role in ('admin', 'staff', 'viewer')
);
