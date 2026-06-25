import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { recordAuditLog, AUDIT_ACTIONS } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const DELETE_ORDER = ['invoices', 'expenses', 'recurring_invoices', 'clients', 'user_settings'] as const

// A service-role client can delete rows across RLS policies and remove the auth
// user itself. It is required to fully erase the account; without it we can
// still delete the user's own data via RLS but cannot remove the auth record.
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey)
}

export async function DELETE(request: Request) {
  try {
    // Identify the caller via the bearer token from their active session, since
    // the server client does not read auth cookies. The token is also attached
    // so RLS-scoped deletes run as the authenticated user when no service-role
    // key is configured.
    const authHeader =
      request.headers.get('authorization') || request.headers.get('Authorization')
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    const authClient = await createClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = accessToken
      ? await authClient.auth.getUser(accessToken)
      : await authClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Prefer the admin client so deletion succeeds regardless of RLS; fall back
    // to the authenticated user client (RLS-scoped) when no service role key is
    // available in the environment.
    const adminClient = createAdminClient()
    const dbClient: any = adminClient ?? authClient

    for (const table of DELETE_ORDER) {
      const tableQuery = dbClient.from(table as any) as any
      const { error } = await tableQuery.delete().eq('user_id', user.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const usersQuery = dbClient.from('users' as any) as any
    const { error: userRowDeleteError } = await usersQuery.delete().eq('id', user.id)
    if (userRowDeleteError) {
      return NextResponse.json({ error: userRowDeleteError.message }, { status: 500 })
    }

    await recordAuditLog({
      action: AUDIT_ACTIONS.GDPR_DELETED,
      actor: user,
      resourceType: 'account',
      resourceId: user.id,
      request,
    })

    // Removing the auth user requires the service-role key. If it is not
    // configured, the account's data has still been erased above; report success
    // so the user is signed out and redirected, but note the limitation.
    if (adminClient) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id)
      if (authDeleteError) {
        return NextResponse.json({ error: authDeleteError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true, authUserRetained: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete account data'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
