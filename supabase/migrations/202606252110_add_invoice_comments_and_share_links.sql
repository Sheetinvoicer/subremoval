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
