-- Entity: auto-detected alerts.
--
-- The detector (lib/entity/detector.ts) polls Sentry, Vercel and performance
-- signals on a schedule and records de-duplicated issues here. High-confidence
-- alerts are additionally linked to an entity_actions fix proposal so an admin
-- can review/apply it.
--
-- Rows are written by trusted server code using the Supabase service-role key
-- (see lib/entity/supabase-store.ts), so no INSERT/UPDATE policy is exposed to
-- authenticated users. Reads are restricted to admins via the existing
-- public.is_admin() SECURITY DEFINER helper, mirroring entity_actions.

create table if not exists public.entity_alerts (
  id uuid primary key default gen_random_uuid(),
  -- sentry | vercel | performance
  source text not null,
  -- low | medium | high | critical
  severity text not null default 'medium',
  title text not null,
  -- stable de-duplication key for a recurring issue
  fingerprint text not null,
  -- open | acknowledged | resolved | dismissed
  status text not null default 'open',
  details jsonb not null default '{}'::jsonb,
  -- the proposed fix (entity_actions.id), when one was filed
  linked_action_id uuid references public.entity_actions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists entity_alerts_created_at_idx on public.entity_alerts (created_at desc);
create index if not exists entity_alerts_status_idx on public.entity_alerts (status);
create index if not exists entity_alerts_fingerprint_idx on public.entity_alerts (fingerprint);

alter table public.entity_alerts enable row level security;

-- DO-guarded policy creation keeps this migration idempotent and avoids the
-- invalid `create policy if not exists` syntax used by earlier migrations.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entity_alerts' and policyname = 'Admins can read entity alerts') then
    create policy "Admins can read entity alerts" on public.entity_alerts
      for select to authenticated using (public.is_admin());
  end if;
end $$;
