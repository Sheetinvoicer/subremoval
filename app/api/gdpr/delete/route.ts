import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DELETE_ORDER = ['invoices', 'expenses', 'recurring_invoices', 'clients', 'user_settings'] as const

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    for (const table of DELETE_ORDER) {
      const tableQuery = supabase.from(table as any) as any
      const { error } = await tableQuery.delete().eq('user_id', user.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const usersQuery = supabase.from('users' as any) as any
    const { error: userRowDeleteError } = await usersQuery.delete().eq('id', user.id)
    if (userRowDeleteError) {
      return NextResponse.json({ error: userRowDeleteError.message }, { status: 500 })
    }

    const authAdmin = (supabase.auth as any).admin
    const { error: authDeleteError } = await authAdmin.deleteUser(user.id)
    if (authDeleteError) {
      return NextResponse.json({ error: authDeleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete account data'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
