import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/subscriptions/gate'
import { FEATURES } from '@/lib/subscriptions/plans'
import {
  generateAssistantReply,
  AssistantAiUnavailableError,
  MAX_MESSAGE_LENGTH,
  type AssistantContext,
} from '@/lib/ai/assistant'

// The Anthropic Node SDK must run on Node (never Edge); force dynamic so auth +
// plan gating are evaluated fresh per request.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Failed to generate a response'
}

// Only forward known, numeric snapshot fields to the model — never arbitrary
// client payloads.
const NUMERIC_CONTEXT_FIELDS: (keyof AssistantContext)[] = [
  'totalRevenue',
  'netProfit',
  'totalExpenses',
  'pendingAmount',
  'pendingCount',
  'overdueAmount',
  'overdueCount',
  'paidThisMonth',
  'totalInvoices',
  'totalClients',
  'revenueChangePct',
  'forecastNextMonth',
]

function sanitizeContext(raw: unknown): AssistantContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const context: AssistantContext = {}
  if (typeof source.currency === 'string' && source.currency.length <= 8) {
    context.currency = source.currency
  }
  for (const field of NUMERIC_CONTEXT_FIELDS) {
    const value = source[field]
    if (typeof value === 'number' && Number.isFinite(value)) {
      ;(context as Record<string, number>)[field] = value
    }
  }
  return Object.keys(context).length > 0 ? context : undefined
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const context = sanitizeContext(body?.context)

    if (!message) {
      return NextResponse.json({ error: 'A message is required.', code: 'message_required' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message is too long.', code: 'message_too_long' }, { status: 400 })
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
        { error: 'The AI assistant is available on the Pro plan and above.', code: 'feature_locked', plan: gate.plan },
        { status: 403 },
      )
    }

    const response = await Sentry.startSpan(
      { name: 'agents.chat', op: 'ai.chat' },
      () => generateAssistantReply({ message, context }),
    )

    return NextResponse.json({ success: true, response })
  } catch (error) {
    if (error instanceof AssistantAiUnavailableError) {
      return NextResponse.json(
        { error: 'The AI assistant is not configured.', code: 'ai_unavailable' },
        { status: 503 },
      )
    }
    Sentry.captureException(error)
    return NextResponse.json({ error: errorMessage(error), code: 'ai_error' }, { status: 502 })
  }
}
