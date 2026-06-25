import { createClient } from '@supabase/supabase-js'

// Stable identifiers for audited actions. Using constants keeps action strings
// consistent across call sites and makes them easy to filter on in the admin UI.
export const AUDIT_ACTIONS = {
  USER_ROLE_UPDATED: 'user.role_updated',
  BACKUP_CREATED: 'backup.created',
  BACKUP_RESTORED: 'backup.restored',
  GDPR_EXPORTED: 'gdpr.exported',
  GDPR_DELETED: 'gdpr.deleted',
}

// Audit rows must be written even from contexts where the caller is acting on
// behalf of another user (or where RLS would otherwise hide the insert), so we
// use the service-role key here exactly like lib/backup/manager.js does.
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

// Pulls the originating IP and user agent from a Next.js Request when one is
// available. Returns empty fields for non-request contexts (e.g. cron jobs).
export function requestContext(request) {
  if (!request || typeof request.headers?.get !== 'function') {
    return { ipAddress: null, userAgent: null }
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ipAddress = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : request.headers.get('x-real-ip')

  return {
    ipAddress: ipAddress || null,
    userAgent: request.headers.get('user-agent') || null,
  }
}

/**
 * Records a single audit log entry.
 *
 * This is intentionally fire-and-forget: a failure to persist an audit row must
 * never break the user-facing action that triggered it. Errors are swallowed
 * (and surfaced in the return value) so callers can `await recordAuditLog(...)`
 * without wrapping every call in try/catch.
 */
export async function recordAuditLog({
  action,
  actor = null,
  resourceType = null,
  resourceId = null,
  metadata = {},
  request = null,
}) {
  if (!action) {
    return { ok: false, error: 'action is required' }
  }

  const { ipAddress, userAgent } = requestContext(request)

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_logs').insert({
      action,
      user_id: actor?.id || null,
      user_email: actor?.email || null,
      resource_type: resourceType,
      resource_id: resourceId != null ? String(resourceId) : null,
      metadata: metadata || {},
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to record audit log' }
  }
}
