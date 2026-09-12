import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/gmail/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // State = user id so we can verify on callback
  const state = user.id
  const authUrl = getGoogleAuthUrl(state)
  return NextResponse.redirect(authUrl)
}
