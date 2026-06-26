import { NextResponse } from 'next/server'
import callAI from '@/lib/ai/config'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/subscriptions/gate'
import { FEATURES } from '@/lib/subscriptions/plans'

function getErrorMessage(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return error.message
  }

  return 'Failed to process AI action request'
}

export async function POST(request) {
  try {
    const body = await request.json()
    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    const payload = body?.payload ?? null

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    // The AI Assistant is a paid feature (Pro and above).
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
    }

    const gate = await requireFeature(supabase, user.id, FEATURES.AI_ASSISTANT)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'The AI Assistant is available on the Pro plan and above.', code: 'feature_locked', plan: gate.plan },
        { status: 403 },
      )
    }

    const prompt = `You are an AI action assistant for an invoicing platform.
Perform this action request and return a concise actionable response.

Action: ${action}
Payload:
${JSON.stringify(payload, null, 2)}`

    const response = await callAI(prompt)

    if (!response || typeof response !== 'string') {
      return NextResponse.json({ error: 'AI provider returned an empty action response' }, { status: 502 })
    }

    return NextResponse.json({ success: true, action, response: response.trim() })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
