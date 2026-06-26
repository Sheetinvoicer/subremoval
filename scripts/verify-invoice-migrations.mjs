#!/usr/bin/env node
/**
 * Read-only verification for the enterprise-invoicing migrations
 * (202606251857 … 202606252240).
 *
 * Probes the live database through PostgREST (so it needs only the public URL +
 * a key — no Postgres password, psql or Supabase CLI) and reports, per
 * migration, whether its tables/columns exist. Makes NO writes.
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
 * environment, falling back to a local .env.local file, so it can be run simply
 * as:
 *   node scripts/verify-invoice-migrations.mjs
 *
 * Exit code: 0 when every check is present, 2 when one or more are missing.
 */
import { readFileSync } from 'node:fs'

function loadEnvFile(path) {
  const out = {}
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      out[m[1]] = v
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
  return out
}

const env = { ...loadEnvFile('.env.local'), ...process.env }
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const base = url.replace(/\/+$/, '')

/** Returns { ok } / { ok:false, code, msg } for a table (or a single column). */
async function probe(table, column) {
  const endpoint = `${base}/rest/v1/${table}?select=${encodeURIComponent(column || '*')}&limit=0`
  let res
  try {
    res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  } catch (e) {
    return { ok: false, code: 'FETCH', msg: String((e && e.message) || e) }
  }
  if (res.ok) return { ok: true }
  let body = ''
  try { body = await res.text() } catch {}
  let code = '', msg = body
  try { const j = JSON.parse(body); code = j.code || ''; msg = j.message || j.hint || body } catch {}
  return { ok: false, code: `${res.status}${code ? '/' + code : ''}`, msg: (msg || '').slice(0, 160) }
}

// One representative object per migration (table existence, or a column the
// migration adds). Order matches supabase/migrations.
const checks = [
  ['202606251857_add_invoice_list_facets', 'invoices.client_name (col)', 'invoices', 'client_name'],
  ['202606251857_add_invoice_list_facets', 'invoices.tags (col)', 'invoices', 'tags'],
  ['202606252036_add_invoice_payments_and_history', 'invoice_payments (table)', 'invoice_payments', null],
  ['202606252036_add_invoice_payments_and_history', 'invoice_history (table)', 'invoice_history', null],
  ['202606252110_add_invoice_comments_and_share_links', 'invoice_comments (table)', 'invoice_comments', null],
  ['202606252110_add_invoice_comments_and_share_links', 'invoice_share_links (table)', 'invoice_share_links', null],
  ['202606252150_add_invoice_drafts', 'invoice_drafts (table)', 'invoice_drafts', null],
  ['202606252240_add_recurring_invoice_exceptions', 'recurring_invoices.exceptions (col)', 'recurring_invoices', 'exceptions'],
]

let missing = 0
for (const [mig, label, table, column] of checks) {
  const r = await probe(table, column)
  if (!r.ok) missing++
  console.log(`${r.ok ? 'PRESENT' : 'MISSING'} | ${mig} | ${label}${r.ok ? '' : `  -> [${r.code}] ${r.msg}`}`)
}

console.log(`\nSummary: ${checks.length - missing}/${checks.length} checks present, ${missing} missing.`)
if (missing > 0) {
  console.log('Apply the pending migrations (see supabase/apply_pending_invoice_migrations.sql) and re-run.')
  process.exit(2)
}
console.log('OK: all enterprise-invoicing migrations are applied.')
