import Anthropic from '@anthropic-ai/sdk'
import { OpenAI } from 'openai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizePlanName } from '@/lib/subscriptions/plans'

/**
 * Admin AI library.
 *
 * Centralises everything the admin-facing AI features need:
 *   - platform-wide data gathering (service-role, RLS-bypassing) so an admin can
 *     reason about every user's activity, not just their own rows;
 *   - deterministic analytics, anomaly detection and recommendations that work
 *     even when no model key is configured;
 *   - a cached Claude helper (with an OpenAI fallback) used for the admin chat,
 *     the auto-generated admin report and AI-enriched optimisation tips.
 *
 * The model calls follow the claude-api guidance: a frozen system prompt sits in
 * the cacheable prefix while the volatile per-request data/question is appended
 * in the user turn, so the prompt-cache prefix stays valid across requests.
 */

// Default model per the claude-api skill. Kept as a constant so the cache prefix
// (model + system) is identical across requests.
const ADMIN_AI_MODEL = 'claude-opus-4-6'
const ADMIN_AI_MAX_TOKENS = 2048
const AI_TIMEOUT_MS = 60_000
const AI_MAX_RETRIES = 1

// OpenAI fallback so admin AI keeps working if the Claude call fails, matching
// the primary/secondary pattern already used in lib/ai/config.js.
const FALLBACK_MODEL = 'gpt-4o'

// Bounded query sizes so a large account can't blow up an admin request.
const MAX_USERS = 1000
const MAX_AUDIT_LOGS = 1000
const MAX_INVOICES = 2000
const MAX_EXPENSES = 2000
const MAX_SUBSCRIPTIONS = 2000

// Frozen system instructions. Do NOT interpolate anything dynamic here — keeping
// the bytes stable is what lets the prompt cache hit across requests.
const ADMIN_SYSTEM_PROMPT = `You are the Admin AI for SheetInvoicer, a multi-tenant invoicing platform.
You assist platform administrators by answering questions about users, activity, usage and risk.

Guidelines:
- Be concise, factual and actionable. Prefer short paragraphs and tight bullet lists.
- Ground every statement in the JSON data you are given. Never invent users, numbers or events.
- If the data is insufficient to answer, say so plainly and suggest what to look at.
- Surface risks (suspicious activity, role-permission mismatches, churn signals) when relevant.
- Never reveal raw secrets, full API keys or password hashes even if present in the data.
- Use the platform's terminology: roles are "admin", "staff" and "viewer".`

const REPORT_SYSTEM_PROMPT = `You are the Admin AI for SheetInvoicer. Write a concise administrator report from the JSON metrics provided.
Structure the report with these markdown sections, in order:
## Overview
## User Activity
## Anomalies & Risks
## Recommendations
Keep it tight and skimmable. Use bullet points. Base every claim strictly on the supplied data.`

const TIPS_SYSTEM_PROMPT = `You are the Admin AI for SheetInvoicer. From the JSON metrics provided, return 3-5 short, high-impact
optimisation tips for the platform administrator (covering invoicing, user roles and feature adoption).
Return a plain markdown bullet list only — no preamble, no headings.`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'staff' | 'viewer'

// The four canonical subscription tiers (see lib/subscriptions/plans.js). Mirrors
// the subscriptions.plan column constrained by the subscription_tiers migration.
export type PlanName = 'Free' | 'Pro' | 'Business' | 'Enterprise'

export interface SubscriptionRow {
  user_id: string | null
  plan: PlanName
  status: string | null
}

export interface AdminUser {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  created_at: string | null
}

export interface AuditEntry {
  id?: string
  action: string
  user_id: string | null
  user_email: string | null
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

export interface InvoiceRow {
  id: string
  user_id: string | null
  total: number | null
  status: string | null
  created_at: string | null
  due_date: string | null
  paid_at: string | null
}

export interface AdminContext {
  generatedAt: string
  users: AdminUser[]
  auditLogs: AuditEntry[]
  invoices: InvoiceRow[]
  subscriptions: SubscriptionRow[]
  expensesTotal: number
  expensesCount: number
  clientsCount: number
}

export interface UsageMetrics {
  totalUsers: number
  usersByRole: Record<Role, number>
  usersByPlan: Record<PlanName, number>
  paidSubscriptions: number
  newUsers30d: number
  activeUsers30d: number
  totalClients: number
  totalInvoices: number
  paidInvoices: number
  overdueInvoices: number
  totalRevenue: number
  pendingRevenue: number
  totalExpenses: number
  auditEvents: number
  auditEvents24h: number
}

export interface ActivityUser {
  userId: string | null
  email: string | null
  actions: number
  lastActiveAt: string | null
  topActions: { action: string; count: number }[]
}

export interface ActivitySummary {
  totalActions: number
  actionsByType: { action: string; count: number }[]
  topUsers: ActivityUser[]
  windowDays: number
}

export type AnomalySeverity = 'low' | 'medium' | 'high'

export interface Anomaly {
  id: string
  severity: AnomalySeverity
  title: string
  detail: string
  userEmail?: string | null
  metric?: number
}

export interface RoleSuggestion {
  userId: string
  email: string | null
  currentRole: Role
  suggestedRole: Role
  reason: string
}

export interface Recommendations {
  roleSuggestions: RoleSuggestion[]
  featureRecommendations: string[]
  invoiceOptimizationTips: string[]
  aiTips?: string
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// Raised when a required environment variable / credential is missing or the
// backing service rejects our credentials (e.g. a bad SUPABASE_SERVICE_ROLE_KEY
// surfaces from PostgREST as "Invalid API key"). Callers map this to a 503 with
// an actionable message instead of an opaque 500, so an operator can see that
// the deployment is mis-configured rather than the code being broken.
export class AdminConfigError extends Error {
  readonly code = 'ADMIN_CONFIG_ERROR'
  readonly missing: string[]
  constructor(message: string, missing: string[] = []) {
    super(message)
    this.name = 'AdminConfigError'
    this.missing = missing
    // Restore the prototype chain: when this class is transpiled down to ES5,
    // extending the built-in Error otherwise breaks `instanceof` checks (which
    // the route helper relies on to map this to a 503).
    Object.setPrototypeOf(this, AdminConfigError.prototype)
  }
}

// Heuristic: does a thrown error look like a credentials/permission problem
// (bad key, RLS/permission denied) rather than a transient/code error? Supabase
// returns "Invalid API key" for a wrong service-role key and "permission denied"
// when RLS blocks the read.
export function isCredentialError(error: unknown): boolean {
  // Accept Error instances, Supabase's plain `{ message }` error objects, or raw
  // strings — pull a message out of whichever shape we were handed.
  const raw =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message ?? '')
        : String(error ?? '')
  const message = raw.toLowerCase()
  return (
    message.includes('invalid api key') ||
    message.includes('invalid_api_key') ||
    message.includes('permission denied') ||
    message.includes('jwt') ||
    message.includes('unauthorized') ||
    message.includes('not authorized') ||
    message.includes('401')
  )
}

// Wrap a Supabase query error for a critical table. Credential/permission
// failures (e.g. a bad SUPABASE_SERVICE_ROLE_KEY → "Invalid API key") become an
// AdminConfigError so routes answer with an actionable 503; anything else stays
// a generic Error (true 500).
function toContextError(label: string, error: { message: string }): Error {
  const message = `Failed to load ${label}: ${error.message}`
  return isCredentialError(error) ? new AdminConfigError(message) : new Error(message)
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: AI_MAX_RETRIES })
}

function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: AI_MAX_RETRIES })
}

// Service-role client so admin analytics can read across every tenant. Mirrors
// the pattern in lib/audit/log.js (which also needs to bypass RLS).
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing: string[] = []
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length > 0) {
    throw new AdminConfigError(
      `Missing Supabase admin environment variables: ${missing.join(', ')}`,
      missing
    )
  }

  // A service-role client authenticates with the key itself rather than a user
  // session, so disable session persistence/refresh. This keeps it a clean,
  // RLS-bypassing server client for one-off admin reads across every tenant.
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeRole(role: unknown): Role {
  const r = typeof role === 'string' ? role.toLowerCase() : ''
  return r === 'admin' || r === 'staff' || r === 'viewer' ? (r as Role) : 'viewer'
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function parseDate(input?: string | null): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

export async function gatherAdminContext(): Promise<AdminContext> {
  const supabase = createAdminClient()

  const [usersRes, auditRes, invoicesRes, clientsRes, expensesRes, subscriptionsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_USERS),
    supabase
      .from('audit_logs')
      .select('id, action, user_id, user_email, resource_type, resource_id, metadata, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_AUDIT_LOGS),
    supabase
      .from('invoices')
      .select('id, user_id, total, status, created_at, due_date, paid_at')
      .order('created_at', { ascending: false })
      .limit(MAX_INVOICES),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase
      .from('expenses')
      .select('amount')
      .order('created_at', { ascending: false })
      .limit(MAX_EXPENSES),
    // Subscription tiers feed the plan-distribution metric. Read the canonical
    // `plan` column (Free/Pro/Business/Enterprise) added by the subscription
    // overhaul. This is a plain list read (never .single()) so a user without a
    // row simply doesn't appear here — it can't trigger a PostgREST 406.
    supabase
      .from('subscriptions')
      .select('user_id, plan, status')
      .limit(MAX_SUBSCRIPTIONS),
  ])

  // Surface query failures instead of silently degrading to empty data. Invoices
  // and users feed every metric the admin AI reports, so a failure there (RLS,
  // permissions, schema drift) must be loud — otherwise the AI would claim the
  // platform has "0 invoices / no data" while hiding the real cause. The remaining
  // tables are non-critical, so we log and continue if one is unavailable.
  if (usersRes.error) {
    throw toContextError('users', usersRes.error)
  }
  if (invoicesRes.error) {
    throw toContextError('invoices', invoicesRes.error)
  }
  const optionalQueries: Array<{ label: string; error: { message: string } | null }> = [
    { label: 'audit_logs', error: auditRes.error },
    { label: 'clients', error: clientsRes.error },
    { label: 'expenses', error: expensesRes.error },
    { label: 'subscriptions', error: subscriptionsRes.error },
  ]
  for (const query of optionalQueries) {
    if (query.error) {
      console.error(`Admin context: ${query.label} query failed, continuing without it:`, query.error.message)
    }
  }

  const users: AdminUser[] = (usersRes.data || []).map((u: Record<string, unknown>) => ({
    id: String(u.id),
    email: (u.email as string) ?? null,
    full_name: (u.full_name as string) ?? null,
    role: normalizeRole(u.role),
    created_at: (u.created_at as string) ?? null,
  }))

  const auditLogs: AuditEntry[] = (auditRes.data || []).map((a: Record<string, unknown>) => ({
    id: a.id ? String(a.id) : undefined,
    action: String(a.action || 'unknown'),
    user_id: (a.user_id as string) ?? null,
    user_email: (a.user_email as string) ?? null,
    resource_type: (a.resource_type as string) ?? null,
    resource_id: (a.resource_id as string) ?? null,
    metadata: (a.metadata as Record<string, unknown>) ?? null,
    ip_address: (a.ip_address as string) ?? null,
    created_at: (a.created_at as string) ?? null,
  }))

  const invoices: InvoiceRow[] = (invoicesRes.data || []).map((i: Record<string, unknown>) => ({
    id: String(i.id),
    user_id: (i.user_id as string) ?? null,
    total: i.total != null ? toNumber(i.total) : null,
    status: (i.status as string) ?? null,
    created_at: (i.created_at as string) ?? null,
    due_date: (i.due_date as string) ?? null,
    paid_at: (i.paid_at as string) ?? null,
  }))

  const expensesRows = expensesRes.data || []
  const expensesTotal = expensesRows.reduce(
    (sum: number, e: Record<string, unknown>) => sum + toNumber(e.amount),
    0
  )

  const subscriptions: SubscriptionRow[] = (subscriptionsRes.data || []).map(
    (s: Record<string, unknown>) => ({
      user_id: (s.user_id as string) ?? null,
      plan: normalizePlanName(s.plan) as PlanName,
      status: (s.status as string) ?? null,
    })
  )

  return {
    generatedAt: new Date().toISOString(),
    users,
    auditLogs,
    invoices,
    subscriptions,
    expensesTotal,
    expensesCount: expensesRows.length,
    clientsCount: clientsRes.count || 0,
  }
}

// ---------------------------------------------------------------------------
// Metrics & analytics
// ---------------------------------------------------------------------------

export function computeMetrics(ctx: AdminContext): UsageMetrics {
  const usersByRole: Record<Role, number> = { admin: 0, staff: 0, viewer: 0 }
  const cutoff30 = daysAgo(30)
  let newUsers30d = 0

  for (const user of ctx.users) {
    usersByRole[user.role] += 1
    const created = parseDate(user.created_at)
    if (created && created >= cutoff30) newUsers30d += 1
  }

  const activeUserIds = new Set<string>()
  const cutoff24h = daysAgo(1)
  let auditEvents24h = 0
  for (const log of ctx.auditLogs) {
    const at = parseDate(log.created_at)
    if (at && at >= cutoff30 && log.user_id) activeUserIds.add(log.user_id)
    if (at && at >= cutoff24h) auditEvents24h += 1
  }

  let paidInvoices = 0
  let overdueInvoices = 0
  let totalRevenue = 0
  let pendingRevenue = 0
  const today = new Date()
  for (const inv of ctx.invoices) {
    const total = toNumber(inv.total)
    const status = (inv.status || '').toLowerCase()
    if (status === 'paid') {
      paidInvoices += 1
      totalRevenue += total
    } else {
      pendingRevenue += total
      const due = parseDate(inv.due_date)
      if (status === 'overdue' || (due && due < today && status !== 'draft')) {
        overdueInvoices += 1
      }
    }
  }

  // Plan distribution from the subscriptions table. Users without a subscription
  // row are treated as Free (matches DEFAULT_PLAN and the migration's Free
  // backfill), so the tiers always reflect the known subscription rows.
  const usersByPlan: Record<PlanName, number> = { Free: 0, Pro: 0, Business: 0, Enterprise: 0 }
  for (const sub of ctx.subscriptions || []) {
    usersByPlan[sub.plan] = (usersByPlan[sub.plan] || 0) + 1
  }
  const usersWithoutSubscription = Math.max(0, ctx.users.length - (ctx.subscriptions?.length || 0))
  usersByPlan.Free += usersWithoutSubscription
  const paidSubscriptions = usersByPlan.Pro + usersByPlan.Business + usersByPlan.Enterprise

  return {
    totalUsers: ctx.users.length,
    usersByRole,
    usersByPlan,
    paidSubscriptions,
    newUsers30d,
    activeUsers30d: activeUserIds.size,
    totalClients: ctx.clientsCount,
    totalInvoices: ctx.invoices.length,
    paidInvoices,
    overdueInvoices,
    totalRevenue,
    pendingRevenue,
    totalExpenses: ctx.expensesTotal,
    auditEvents: ctx.auditLogs.length,
    auditEvents24h,
  }
}

export function analyzeActivity(ctx: AdminContext, windowDays = 30): ActivitySummary {
  const cutoff = daysAgo(windowDays)
  const byType = new Map<string, number>()
  const byUser = new Map<
    string,
    { email: string | null; actions: number; lastActiveAt: string | null; actions_by_type: Map<string, number> }
  >()

  let totalActions = 0
  for (const log of ctx.auditLogs) {
    const at = parseDate(log.created_at)
    if (at && at < cutoff) continue
    totalActions += 1
    byType.set(log.action, (byType.get(log.action) || 0) + 1)

    const key = log.user_id || log.user_email || 'unknown'
    const existing =
      byUser.get(key) || { email: log.user_email, actions: 0, lastActiveAt: null, actions_by_type: new Map() }
    existing.actions += 1
    existing.actions_by_type.set(log.action, (existing.actions_by_type.get(log.action) || 0) + 1)
    if (!existing.lastActiveAt || (log.created_at && log.created_at > existing.lastActiveAt)) {
      existing.lastActiveAt = log.created_at
    }
    if (!existing.email && log.user_email) existing.email = log.user_email
    byUser.set(key, existing)
  }

  const actionsByType = Array.from(byType.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)

  const topUsers: ActivityUser[] = Array.from(byUser.entries())
    .map(([userId, value]) => ({
      userId: userId === 'unknown' ? null : userId,
      email: value.email,
      actions: value.actions,
      lastActiveAt: value.lastActiveAt,
      topActions: Array.from(value.actions_by_type.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 10)

  return { totalActions, actionsByType, topUsers, windowDays }
}

// ---------------------------------------------------------------------------
// Anomaly detection (heuristic, deterministic)
// ---------------------------------------------------------------------------

export function detectAnomalies(ctx: AdminContext): Anomaly[] {
  const anomalies: Anomaly[] = []
  const cutoff24h = daysAgo(1)

  // 1. Bursts of activity from a single user in the last 24h.
  const actionsByUser24h = new Map<string, { email: string | null; count: number }>()
  // 2. Logins/actions from many distinct IPs (possible account sharing/compromise).
  const ipsByUser = new Map<string, Set<string>>()
  // 3. Spikes in sensitive actions (role changes, deletions, restores).
  let roleChanges24h = 0
  let destructive24h = 0

  for (const log of ctx.auditLogs) {
    const at = parseDate(log.created_at)
    const key = log.user_email || log.user_id || 'unknown'

    if (log.ip_address) {
      const set = ipsByUser.get(key) || new Set<string>()
      set.add(log.ip_address)
      ipsByUser.set(key, set)
    }

    if (at && at >= cutoff24h) {
      const entry = actionsByUser24h.get(key) || { email: log.user_email, count: 0 }
      entry.count += 1
      actionsByUser24h.set(key, entry)

      const action = log.action.toLowerCase()
      if (action.includes('role')) roleChanges24h += 1
      if (action.includes('delete') || action.includes('restore') || action.includes('gdpr')) destructive24h += 1
    }
  }

  for (const [key, entry] of actionsByUser24h.entries()) {
    if (entry.count >= 50) {
      anomalies.push({
        id: `burst:${key}`,
        severity: entry.count >= 150 ? 'high' : 'medium',
        title: 'Unusual activity burst',
        detail: `${entry.count} actions in the last 24h from a single account.`,
        userEmail: entry.email,
        metric: entry.count,
      })
    }
  }

  for (const [key, ips] of ipsByUser.entries()) {
    if (ips.size >= 5) {
      anomalies.push({
        id: `multi-ip:${key}`,
        severity: ips.size >= 10 ? 'high' : 'medium',
        title: 'Multiple source IPs',
        detail: `${ips.size} distinct IP addresses observed for one account — possible sharing or compromise.`,
        userEmail: key.includes('@') ? key : null,
        metric: ips.size,
      })
    }
  }

  if (roleChanges24h >= 3) {
    anomalies.push({
      id: 'role-churn',
      severity: roleChanges24h >= 6 ? 'high' : 'medium',
      title: 'Frequent role changes',
      detail: `${roleChanges24h} role changes in the last 24h. Verify these were authorised.`,
      metric: roleChanges24h,
    })
  }

  if (destructive24h >= 3) {
    anomalies.push({
      id: 'destructive-ops',
      severity: destructive24h >= 6 ? 'high' : 'medium',
      title: 'Spike in destructive operations',
      detail: `${destructive24h} delete/restore/GDPR actions in the last 24h.`,
      metric: destructive24h,
    })
  }

  // 4. Overdue concentration — operational (not security) risk worth flagging.
  const metrics = computeMetrics(ctx)
  if (metrics.totalInvoices >= 10 && metrics.overdueInvoices / metrics.totalInvoices >= 0.4) {
    anomalies.push({
      id: 'overdue-concentration',
      severity: 'medium',
      title: 'High overdue ratio',
      detail: `${metrics.overdueInvoices} of ${metrics.totalInvoices} invoices are overdue (${Math.round(
        (metrics.overdueInvoices / metrics.totalInvoices) * 100
      )}%).`,
      metric: metrics.overdueInvoices,
    })
  }

  return anomalies.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
}

function severityRank(severity: AnomalySeverity): number {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1
}

// ---------------------------------------------------------------------------
// Recommendations (heuristic, deterministic)
// ---------------------------------------------------------------------------

export function buildRecommendations(ctx: AdminContext): Recommendations {
  const activity = analyzeActivity(ctx, 30)
  const actionsByUser = new Map<string, number>()
  for (const u of activity.topUsers) {
    if (u.userId) actionsByUser.set(u.userId, u.actions)
  }

  const roleSuggestions: RoleSuggestion[] = []
  for (const user of ctx.users) {
    const actions = actionsByUser.get(user.id) || 0
    // Promote highly active viewers who are effectively operating as staff.
    if (user.role === 'viewer' && actions >= 20) {
      roleSuggestions.push({
        userId: user.id,
        email: user.email,
        currentRole: user.role,
        suggestedRole: 'staff',
        reason: `High engagement (${actions} actions in 30 days) suggests this viewer needs staff access.`,
      })
    }
    // Flag dormant admins for a downgrade review (least-privilege hygiene).
    if (user.role === 'admin' && actions === 0) {
      const created = parseDate(user.created_at)
      const isRecent = created && created >= daysAgo(14)
      if (!isRecent) {
        roleSuggestions.push({
          userId: user.id,
          email: user.email,
          currentRole: user.role,
          suggestedRole: 'staff',
          reason: 'Dormant admin with no recent activity — review whether admin rights are still needed.',
        })
      }
    }
  }

  const metrics = computeMetrics(ctx)
  const featureRecommendations: string[] = []
  if (metrics.activeUsers30d / Math.max(metrics.totalUsers, 1) < 0.5) {
    featureRecommendations.push('Less than half of users were active this month — consider an onboarding tour or re-engagement email.')
  }
  if (metrics.usersByRole.staff === 0 && metrics.totalUsers > 1) {
    featureRecommendations.push('No staff-role users exist — delegate day-to-day work by promoting trusted viewers to staff.')
  }
  if (metrics.totalClients === 0) {
    featureRecommendations.push('No clients recorded yet — import clients via CSV to unlock reporting and recurring invoices.')
  }
  if (metrics.auditEvents === 0) {
    featureRecommendations.push('No audit events captured — confirm audit logging is wired into sensitive actions.')
  }

  const invoiceOptimizationTips: string[] = []
  if (metrics.overdueInvoices > 0) {
    invoiceOptimizationTips.push(`${metrics.overdueInvoices} invoices are overdue — enable automatic payment reminders to recover ${formatCurrency(metrics.pendingRevenue)}.`)
  }
  if (metrics.paidInvoices > 0 && metrics.totalRevenue > 0) {
    invoiceOptimizationTips.push(`Average paid invoice value is ${formatCurrency(metrics.totalRevenue / metrics.paidInvoices)} — consider tiered or recurring billing to grow it.`)
  }
  if (metrics.totalInvoices === 0) {
    invoiceOptimizationTips.push('No invoices yet — create your first invoice or set up a recurring template to start tracking revenue.')
  }

  return { roleSuggestions, featureRecommendations, invoiceOptimizationTips }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  )
}

// ---------------------------------------------------------------------------
// Model calls (Claude primary w/ prompt caching, OpenAI fallback)
// ---------------------------------------------------------------------------

interface RunModelOptions {
  system: string
  userContent: string
  history?: ChatTurn[]
  maxTokens?: number
}

async function runModel({ system, userContent, history = [], maxTokens = ADMIN_AI_MAX_TOKENS }: RunModelOptions): Promise<string | null> {
  const claude = getAnthropic()

  if (claude) {
    try {
      const messages: Anthropic.MessageParam[] = [
        ...history.map((turn) => ({ role: turn.role, content: turn.content }) as Anthropic.MessageParam),
        { role: 'user', content: userContent },
      ]

      const response = await claude.messages.create({
        model: ADMIN_AI_MODEL,
        max_tokens: maxTokens,
        // Frozen instructions in the cacheable prefix; volatile data rides in the
        // user turn after it so repeated calls reuse the cached system prompt.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
      })

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()

      if (text) return text
    } catch (error) {
      console.error('Admin AI (Claude) error, falling back:', error)
    }
  }

  // Fallback: OpenAI GPT-4o.
  const openai = getOpenAI()
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: FALLBACK_MODEL,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
          { role: 'user', content: userContent },
        ],
      })
      const text = response.choices?.[0]?.message?.content?.trim()
      if (text) return text
    } catch (error) {
      console.error('Admin AI (OpenAI) error:', error)
    }
  }

  // No model produced output — either no key is configured or every provider
  // errored (an invalid/expired API key surfaces here as a caught 401). Return
  // null so callers can degrade to deterministic output instead of turning a
  // missing/broken key into a user-facing 500.
  return null
}

// Compact, model-friendly view of the platform state shared with every AI call.
function buildDataSnapshot(ctx: AdminContext): Record<string, unknown> {
  const metrics = computeMetrics(ctx)
  const activity = analyzeActivity(ctx, 30)
  const anomalies = detectAnomalies(ctx)
  return {
    generatedAt: ctx.generatedAt,
    metrics,
    activity: {
      totalActions: activity.totalActions,
      actionsByType: activity.actionsByType.slice(0, 12),
      topUsers: activity.topUsers,
    },
    anomalies,
    users: ctx.users.slice(0, 50).map((u) => ({ email: u.email, role: u.role, created_at: u.created_at })),
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallbacks
//
// When no model is available (no key configured, or every provider errored —
// e.g. an invalid/expired key), the admin AI must still return useful output
// instead of failing the request. These builders reuse the same deterministic
// metrics the dashboard already shows, so the report, tips and chat endpoints
// degrade gracefully (HTTP 200) rather than surfacing a 500 / "Invalid API key".
// ---------------------------------------------------------------------------

const MODEL_UNAVAILABLE_NOTE =
  '_AI model unavailable — showing computed analytics. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-written insights._'

function buildDeterministicReport(ctx: AdminContext): string {
  const metrics = computeMetrics(ctx)
  const activity = analyzeActivity(ctx, 30)
  const anomalies = detectAnomalies(ctx)
  const recommendations = buildRecommendations(ctx)

  const lines: string[] = []
  lines.push('## Overview')
  lines.push(`- Total users: ${metrics.totalUsers} (admins ${metrics.usersByRole.admin}, staff ${metrics.usersByRole.staff}, viewers ${metrics.usersByRole.viewer})`)
  lines.push(`- Plans: Free ${metrics.usersByPlan.Free}, Pro ${metrics.usersByPlan.Pro}, Business ${metrics.usersByPlan.Business}, Enterprise ${metrics.usersByPlan.Enterprise} (${metrics.paidSubscriptions} paid)`)
  lines.push(`- New users (30d): ${metrics.newUsers30d}; active (30d): ${metrics.activeUsers30d}`)
  lines.push(`- Invoices: ${metrics.totalInvoices} total, ${metrics.paidInvoices} paid, ${metrics.overdueInvoices} overdue`)
  lines.push(`- Revenue: ${formatCurrency(metrics.totalRevenue)} collected, ${formatCurrency(metrics.pendingRevenue)} pending`)

  lines.push('')
  lines.push('## User Activity')
  if (activity.totalActions === 0) {
    lines.push('- No audit activity recorded in the last 30 days.')
  } else {
    lines.push(`- ${activity.totalActions} actions in the last 30 days.`)
    for (const user of activity.topUsers.slice(0, 5)) {
      lines.push(`- ${user.email || user.userId || 'unknown'}: ${user.actions} actions`)
    }
  }

  lines.push('')
  lines.push('## Anomalies & Risks')
  if (anomalies.length === 0) {
    lines.push('- No anomalies detected.')
  } else {
    for (const anomaly of anomalies) {
      lines.push(`- [${anomaly.severity}] ${anomaly.title}: ${anomaly.detail}`)
    }
  }

  lines.push('')
  lines.push('## Recommendations')
  const recs = [
    ...recommendations.featureRecommendations,
    ...recommendations.invoiceOptimizationTips,
    ...recommendations.roleSuggestions.map((s) => `${s.email || s.userId}: ${s.reason}`),
  ]
  if (recs.length === 0) {
    lines.push('- No recommendations at this time.')
  } else {
    for (const rec of recs) lines.push(`- ${rec}`)
  }

  lines.push('')
  lines.push(MODEL_UNAVAILABLE_NOTE)
  return lines.join('\n')
}

function buildDeterministicTips(ctx: AdminContext): string {
  const recommendations = buildRecommendations(ctx)
  const tips = [...recommendations.invoiceOptimizationTips, ...recommendations.featureRecommendations].slice(0, 5)
  if (tips.length === 0) {
    tips.push('Platform metrics look healthy — keep monitoring overdue invoices and user activity.')
  }
  return [...tips.map((tip) => `- ${tip}`), '', MODEL_UNAVAILABLE_NOTE].join('\n')
}

function buildDeterministicAnswer(ctx: AdminContext, question: string): string {
  const metrics = computeMetrics(ctx)
  const anomalies = detectAnomalies(ctx)
  const lines: string[] = []
  lines.push(`Here is what the current platform data shows (re: "${question.slice(0, 200)}"):`)
  lines.push('')
  lines.push(`- Users: ${metrics.totalUsers} (${metrics.usersByRole.admin} admin, ${metrics.usersByRole.staff} staff, ${metrics.usersByRole.viewer} viewer)`)
  lines.push(`- Plans: Free ${metrics.usersByPlan.Free}, Pro ${metrics.usersByPlan.Pro}, Business ${metrics.usersByPlan.Business}, Enterprise ${metrics.usersByPlan.Enterprise}`)
  lines.push(`- Invoices: ${metrics.totalInvoices} (${metrics.paidInvoices} paid, ${metrics.overdueInvoices} overdue)`)
  lines.push(`- Revenue: ${formatCurrency(metrics.totalRevenue)} collected, ${formatCurrency(metrics.pendingRevenue)} pending`)
  lines.push(`- Audit events: ${metrics.auditEvents} total, ${metrics.auditEvents24h} in the last 24h`)
  if (anomalies.length > 0) {
    lines.push(`- Open anomalies: ${anomalies.map((a) => a.title).join(', ')}`)
  }
  lines.push('')
  lines.push(MODEL_UNAVAILABLE_NOTE)
  return lines.join('\n')
}

export async function askAdminAI(question: string, history: ChatTurn[] = [], ctx?: AdminContext): Promise<string> {
  const context = ctx || (await gatherAdminContext())
  const snapshot = buildDataSnapshot(context)
  const userContent = `Current platform data (JSON):\n${JSON.stringify(snapshot)}\n\nAdministrator question: ${question}`
  const answer = await runModel({ system: ADMIN_SYSTEM_PROMPT, userContent, history })
  return answer ?? buildDeterministicAnswer(context, question)
}

export async function generateAdminReport(ctx?: AdminContext): Promise<string> {
  const context = ctx || (await gatherAdminContext())
  const snapshot = buildDataSnapshot(context)
  const userContent = `Metrics JSON:\n${JSON.stringify(snapshot)}\n\nWrite the administrator report now.`
  const report = await runModel({ system: REPORT_SYSTEM_PROMPT, userContent, maxTokens: 1536 })
  return report ?? buildDeterministicReport(context)
}

export async function generateAiTips(ctx?: AdminContext): Promise<string> {
  const context = ctx || (await gatherAdminContext())
  const snapshot = buildDataSnapshot(context)
  const userContent = `Metrics JSON:\n${JSON.stringify(snapshot)}\n\nReturn the optimisation tips now.`
  const tips = await runModel({ system: TIPS_SYSTEM_PROMPT, userContent, maxTokens: 512 })
  return tips ?? buildDeterministicTips(context)
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface AdminAiHealth {
  ok: boolean
  status: 'ok' | 'degraded' | 'error'
  supabase: {
    url: boolean
    serviceRoleKey: boolean
    reachable: boolean | null
    error: string | null
  }
  ai: {
    anthropic: boolean
    openai: boolean
    available: boolean
  }
  missing: string[]
  checkedAt: string
}

// Diagnoses the Admin-AI runtime without ever returning secret values — only
// booleans about whether each credential is present and (optionally) whether the
// service-role key actually authenticates against Supabase. This powers
// /api/health so an operator can tell at a glance which Vercel env var is
// missing or invalid (the usual cause of the 500 / "Invalid API key").
export async function getAdminAiHealth(options: { probe?: boolean } = {}): Promise<AdminAiHealth> {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY)
  const openai = Boolean(process.env.OPENAI_API_KEY)

  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!anthropic && !openai) missing.push('ANTHROPIC_API_KEY|OPENAI_API_KEY')

  let reachable: boolean | null = null
  let probeError: string | null = null

  // Optional live probe: a tiny head-count read confirms the service-role key is
  // not just present but valid. Skipped by default to keep the endpoint cheap.
  if (options.probe && url && serviceRoleKey) {
    try {
      const supabase = createAdminClient()
      const { error } = await supabase.from('users').select('id', { count: 'exact', head: true })
      if (error) {
        reachable = false
        probeError = error.message
      } else {
        reachable = true
      }
    } catch (error) {
      reachable = false
      probeError = error instanceof Error ? error.message : 'Supabase probe failed'
    }
  }

  const configMissing = !url || !serviceRoleKey
  const probeFailed = reachable === false
  const ok = !configMissing && !probeFailed
  const aiAvailable = anthropic || openai

  return {
    ok,
    // "degraded" = the platform can still serve deterministic analytics (no AI
    // key) but is otherwise healthy; "error" = a hard mis-configuration.
    status: !ok ? 'error' : aiAvailable ? 'ok' : 'degraded',
    supabase: { url, serviceRoleKey, reachable, error: probeError },
    ai: { anthropic, openai, available: aiAvailable },
    missing,
    checkedAt: new Date().toISOString(),
  }
}
