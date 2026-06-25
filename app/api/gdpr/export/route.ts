import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordAuditLog, AUDIT_ACTIONS } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

// Note: the authenticated user's profile/account data lives in Supabase's
// `auth.users` table (exposed via the session), not in a `public.users` table.
// We therefore source the user record from the session below and only query the
// application-owned tables here.
const USER_TABLES = [
  'clients',
  'invoices',
  'expenses',
  'recurring_invoices',
  'user_settings',
] as const

export async function GET(request: Request) {
  try {
    // The server Supabase client is created with the anon key and does not read
    // auth cookies, so we authenticate the request via the bearer token the
    // browser sends from its active session. The token is also attached to the
    // client so the per-table queries run as the authenticated user under RLS.
    const authHeader =
      request.headers.get('authorization') || request.headers.get('Authorization')
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    const supabase = await createClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const exportedAt = new Date().toISOString()

    const tableResults = await Promise.all(
      USER_TABLES.map(async (table) => {
        const query = supabase.from(table as any).select('*').eq('user_id', user.id) as any
        const { data, error } = await query

        return { table, data: data ?? [], error }
      })
    )

    const failedTable = tableResults.find((result) => result.error)
    if (failedTable) {
      return NextResponse.json({ error: failedTable.error?.message ?? 'Failed to export data' }, { status: 500 })
    }

    const authUser = user as any

    const payload = {
      user: {
        id: user.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
      },
      exported_at: exportedAt,
      data: tableResults.reduce<Record<string, unknown[]>>((acc, item) => {
        acc[item.table] = item.data
        return acc
      }, {}),
    }

    await recordAuditLog({
      action: AUDIT_ACTIONS.GDPR_EXPORTED,
      actor: user,
      resourceType: 'account',
      resourceId: user.id,
      request,
    })

    return NextResponse.json(payload, {
      headers: {
        'Content-Disposition': `attachment; filename="sheetinvoicer-export-${user.id}.json"`,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to export data'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
