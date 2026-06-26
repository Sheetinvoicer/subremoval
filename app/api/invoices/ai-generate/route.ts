import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/subscriptions/gate'
import { FEATURES } from '@/lib/subscriptions/plans'
import {
  generateInvoiceContent,
  InvoiceAiUnavailableError,
  MAX_BRIEF_LENGTH,
} from '@/lib/ai/invoice'

// The Anthropic Node SDK must run on Node (never Edge); force dynamic so auth +
// plan gating are evaluated fresh per request.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Failed to generate invoice content'
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const brief = typeof body?.brief === 'string' ? body.brief.trim() : ''
    const currency = typeof body?.currency === 'string' && body.currency ? body.currency : 'USD'
    const locale = typeof body?.locale === 'string' && body.locale ? body.locale : 'en'

    if (!brief) {
      return NextResponse.json({ error: 'A description is required.', code: 'brief_required' }, { status: 400 })
    }
    if (brief.length > MAX_BRIEF_LENGTH) {
      return NextResponse.json({ error: 'Description is too long.', code: 'brief_too_long' }, { status: 400 })
    }

    // AI is a paid feature (Pro and above) — enforce server-side regardless of UI.
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in.', code: 'unauthorized' }, { status: 401 })
    }

    const gate = await requireFeature(supabase, user.id, FEATURES.AI_ASSISTANT)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'AI generation is available on the Pro plan and above.', code: 'feature_locked', plan: gate.plan },
        { status: 403 },
      )
    }

    const content = await Sentry.startSpan(
      { name: 'invoices.ai.generate', op: 'ai.generate' },
      () => generateInvoiceContent({ brief, currency, locale }),
    )

    return NextResponse.json({ success: true, items: content.items, notes: content.notes })
  } catch (error) {
    if (error instanceof InvoiceAiUnavailableError) {
      return NextResponse.json(
        { error: 'AI generation is not configured.', code: 'ai_unavailable' },
        { status: 503 },
      )
    }
    Sentry.captureException(error)
    return NextResponse.json({ error: errorMessage(error), code: 'ai_error' }, { status: 502 })
  }
}
