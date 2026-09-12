import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Welcome emails are temporarily disabled (email provider paused).
// Signup confirmation is handled by Supabase Auth directly.
export async function POST() {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: 'Welcome emails disabled. Supabase Auth handles signup confirmation.',
  })
}
