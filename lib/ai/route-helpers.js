import { NextResponse } from 'next/server'
import { AdminConfigError } from '@/lib/ai/admin'

// Shared error responder for the admin-AI routes.
//
// A mis-configured deployment (missing/invalid SUPABASE_SERVICE_ROLE_KEY → the
// PostgREST "Invalid API key" error) is an operator problem, not a code bug, so
// surface it as a 503 with an actionable, non-secret message instead of an
// opaque 500. Everything else stays a generic 500. The error is always logged
// server-side so the full detail is available in the platform logs.
export function adminAiErrorResponse(error, fallbackMessage) {
  console.error(`${fallbackMessage}:`, error)

  if (error instanceof AdminConfigError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.missing && error.missing.length > 0 ? { missing: error.missing } : {}),
      },
      { status: 503 }
    )
  }

  const messageText = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: messageText }, { status: 500 })
}
