#!/usr/bin/env node
/**
 * Read-only verification for the subscription tiers migration
 * (202606250411_subscription_tiers.sql).
 *
 * Prints the current plan distribution, flags any non-canonical plan values,
 * and checks that the supporting tables exist. Makes NO writes.
 *
 * Usage (after applying the migration to the target database):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-subscription-migration.mjs
 */
import { createClient } from '@supabase/supabase-js'

const VALID_TIERS = ['Free', 'Pro', 'Business', 'Enterprise']

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(url, key)

async function tableStatus(table) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return error ? `MISSING/inaccessible (${error.message})` : 'present'
}

async function main() {
  const { data: subs, error } = await supabase.from('subscriptions').select('plan')
  if (error) {
    console.error('Failed to read subscriptions:', error.message)
    process.exit(1)
  }

  const dist = {}
  for (const row of subs || []) {
    const plan = row.plan || '(null)'
    dist[plan] = (dist[plan] || 0) + 1
  }

  console.log('Subscription plan distribution:')
  for (const [plan, count] of Object.entries(dist).sort()) {
    const flag = VALID_TIERS.includes(plan) ? '' : '   <-- NOT a canonical tier'
    console.log(`  ${String(plan).padEnd(12)} ${count}${flag}`)
  }

  const invalid = (subs || []).filter((r) => !VALID_TIERS.includes(r.plan)).length
  console.log(`\nRows with non-canonical plan values: ${invalid}`)

  const { data: limits, error: limitsErr } = await supabase
    .from('plan_limits')
    .select('plan, resource, max_count')
  console.log(`plan_limits rows: ${limitsErr ? 'table missing' : (limits?.length ?? 0)}`)

  console.log(`team_members: ${await tableStatus('team_members')}`)
  console.log(`sso_connections: ${await tableStatus('sso_connections')}`)

  if (invalid > 0) {
    console.log('\nWARNING: non-canonical plan values found. Re-check the migration normalization step.')
    process.exit(2)
  }
  console.log('\nOK: all plan values are canonical.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
