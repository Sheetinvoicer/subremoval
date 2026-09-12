import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getGmailUserEmail } from '@/lib/gmail/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/subscriptions/scan?error=${error}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/subscriptions/scan?error=missing_code', request.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== state) {
    return NextResponse.redirect(new URL('/dashboard/subscriptions/scan?error=state_mismatch', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const email = await getGmailUserEmail(tokens.access_token)

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error: dbError } = await supabase
      .from('sr_gmail_tokens')
      .upsert(
        {
          user_id: user.id,
          email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expires_at: expiresAt,
        },
        { onConflict: 'user_id' }
      )

    if (dbError) {
      return NextResponse.redirect(
        new URL(`/dashboard/subscriptions/scan?error=db_${encodeURIComponent(dbError.message)}`, request.url)
      )
    }

    return NextResponse.redirect(new URL('/dashboard/subscriptions/scan?connected=1', request.url))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.redirect(
      new URL(`/dashboard/subscriptions/scan?error=${encodeURIComponent(msg)}`, request.url)
    )
  }
}
