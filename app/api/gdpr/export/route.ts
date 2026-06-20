import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const USER_TABLES = [
  'clients',
  'invoices',
  'expenses',
  'recurring_invoices',
  'user_settings',
  'users',
] as const

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const exportedAt = new Date().toISOString()

    const tableResults = await Promise.all(
      USER_TABLES.map(async (table) => {
        const query = supabase.from(table as any).select('*').eq('user_id', user.id) as any
        const { data, error } = await query

        if (table === 'users' && error) {
          const fallback = await (supabase.from('users' as any).select('*').eq('id', user.id) as any)
          return { table, data: fallback.data ?? [], error: fallback.error }
        }

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
