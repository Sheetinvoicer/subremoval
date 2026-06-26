import { NextResponse } from 'next/server'
import { EntityActionError, EntityStoppedError } from './safety'
import type { EntityActor } from './types'

/** Builds an {@link EntityActor} from a Supabase auth user (or null). */
export function actorFromUser(
  user: { id?: string | null; email?: string | null } | null | undefined,
): EntityActor {
  return { id: user?.id ?? null, email: user?.email ?? null }
}

/** Generates an id, preferring a real UUID when the runtime provides one. */
export function newId(prefix = 'id'): string {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID()
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Maps entity errors to appropriate HTTP responses:
 * - emergency stop  → 423 Locked
 * - bad action/state → 400 Bad Request
 * - anything else    → 500 (logged server-side).
 */
export function entityErrorResponse(error: unknown, fallback: string): NextResponse {
  console.error(`${fallback}:`, error)
  if (error instanceof EntityStoppedError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 423 })
  }
  if (error instanceof EntityActionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
  }
  const message = error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status: 500 })
}
