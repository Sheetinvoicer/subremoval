import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  searchSubscriptionEmails, getMessageDetails, extractSubscriptionsFromBatch,
  normalizeName, type EmailDetail, type DetectedSubscription,
} from '@/lib/gmail/scanner'
import { refreshAccessToken } from '@/lib/gmail/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const BATCH_SIZE = 10
const MAX_EMAILS = 100

interface AggregatedSub extends DetectedSubscription {
  _latestFailure: string | null
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    // === PAYWALL + SCAN LIMIT ===
    // Require a paid row in sr_paid_users (set by Stripe checkout).
    const { data: paidRow } = await supabase
      .from('sr_paid_users')
      .select('scan_count_this_month, scan_period_start, lifetime')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!paidRow) {
      return NextResponse.json(
        { error: 'Lifetime access required. Buy for $4.99 to unlock scanning.', code: 'not_paid' },
        { status: 402 }
      )
    }

    // Reset monthly counter if we've moved into a new month
    const now = new Date()
    const periodStart = new Date(paidRow.scan_period_start)
    const isNewMonth =
      now.getMonth() !== periodStart.getMonth() ||
      now.getFullYear() !== periodStart.getFullYear()

    const currentCount = isNewMonth ? 0 : (paidRow.scan_count_this_month ?? 0)

    if (currentCount >= 3) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return NextResponse.json(
        {
          error: `You've used all 3 scans this month. Resets on ${nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`,
          code: 'scan_limit_reached',
          resets_on: nextMonth.toISOString(),
        },
        { status: 429 }
      )
    }

    // Increment counter BEFORE scan (so concurrent requests can't bypass)
    await supabase
      .from('sr_paid_users')
      .update({
        scan_count_this_month: currentCount + 1,
        scan_period_start: isNewMonth
          ? now.toISOString().slice(0, 10)
          : paidRow.scan_period_start,
      })
      .eq('user_id', user.id)
    // === END PAYWALL ===

    const { data: tokenRow } = await supabase.from('sr_gmail_tokens').select('*').eq('user_id', user.id).maybeSingle()
    if (!tokenRow) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

    let accessToken = tokenRow.access_token
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      if (!tokenRow.refresh_token) return NextResponse.json({ error: 'Token expired' }, { status: 400 })
      const fresh = await refreshAccessToken(tokenRow.refresh_token)
      accessToken = fresh.access_token
      await supabase.from('sr_gmail_tokens').update({
        access_token: fresh.access_token,
        expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      }).eq('user_id', user.id)
    }

    const { data: exclusions } = await supabase.from('sr_user_excluded_domains').select('domain').eq('user_id', user.id)
    const excludedDomains = new Set((exclusions ?? []).map((e: { domain: string }) => e.domain))

    const { data: identifierRows } = await supabase
      .from('sr_user_identifiers')
      .select('domain, business_name')
      .eq('user_id', user.id)
    const identifiers = (identifierRows ?? []).map((r: { domain: string | null; business_name: string | null }) => ({
      domain: r.domain,
      businessName: r.business_name,
    }))

    const allIds = await searchSubscriptionEmails(accessToken)
    const messageIds = allIds.slice(0, MAX_EMAILS)

    const details: EmailDetail[] = []
    for (const id of messageIds) {
      const d = await getMessageDetails(accessToken, id)
      if (d) details.push(d)
    }
    console.log('[SCAN] Fetched', details.length, 'emails')

    const rawResults: DetectedSubscription[] = []
    const userEmail = user.email ?? ''
    for (let i = 0; i < details.length; i += BATCH_SIZE) {
      const batch = details.slice(i, i + BATCH_SIZE)
      const found = await extractSubscriptionsFromBatch(batch, userEmail, excludedDomains, identifiers)
      rawResults.push(...found)
    }

    // === AGGREGATE per service: success wins over failures ===
    const byName = new Map<string, DetectedSubscription[]>()
    for (const r of rawResults) {
      const key = normalizeName(r.service_name)
      if (!key) continue
      if (!byName.has(key)) byName.set(key, [])
      byName.get(key)!.push(r)
    }

    const aggregated: AggregatedSub[] = []
    for (const group of byName.values()) {
      const successes = group.filter((g) => g.payment_status === 'success')
      const failures = group.filter((g) => g.payment_status === 'failed')
      const cancelledByProvider = group.some((g) => g.payment_status === 'cancelled_by_provider')

      const base = successes.sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))[0] ?? group[0]

      const latestSuccess = successes.map((s) => s.event_date).filter(Boolean).sort().at(-1) ?? null
      const latestFailure = failures.map((f) => f.event_date).filter(Boolean).sort().at(-1) ?? null

      aggregated.push({
        ...base,
        last_charged_date: latestSuccess,
        confidence: successes.length > 0 ? 'high' : base.confidence,
        payment_status: cancelledByProvider ? 'cancelled_by_provider' : 'success',
        _latestFailure: latestFailure,
      })
    }

    // Drop one-time purchases (credit top-ups, single charges) so they don't pollute the subscription list.
    const recurringOnly = aggregated.filter((s) => s.is_recurring !== false)
    console.log('[SCAN] Aggregated to', aggregated.length, 'unique services;', recurringOnly.length, 'recurring')

    const finalAggregated = recurringOnly

    // === UPSERT respecting prior decisions ===
    const { data: existingRows } = await supabase
      .from('sr_detected_subscriptions')
      .select('*')
      .eq('user_id', user.id)

    const existingByName = new Map(
      (existingRows ?? []).map((r: {
        id: string
        service_name: string
        status: string
        cancelled_at: string | null
        amount: number | null
        currency: string | null
        cancel_url: string | null
        last_seen_at: string | null
        last_failed_at: string | null
        amount_source: string | null
        failed_attempt_count: number | null
        decline_type: string | null
      }) => [
        normalizeName(r.service_name),
        r,
      ])
    )

    for (const s of finalAggregated) {
      const key = normalizeName(s.service_name)
      const existing = existingByName.get(key)

      if (existing?.status === 'dismissed') {
        console.log('[SCAN] Keeping dismissed:', s.service_name)
        continue
      }

      const isCancelledByProvider = s.payment_status === 'cancelled_by_provider'
      const isResubscribe =
        existing?.status === 'cancelled' &&
        s.last_charged_date != null &&
        (existing.cancelled_at == null || s.last_charged_date > existing.cancelled_at.slice(0, 10))

      const nextStatus = isCancelledByProvider ? 'cancelled' : isResubscribe ? 'active' : (existing?.status ?? 'active')

      // last_seen_at only ever advances on a real success — never touched by failures
      const newSuccessDate = s.last_charged_date
        ? new Date(`${s.last_charged_date}T12:00:00Z`).toISOString()
        : null
      const priorSuccessDate = existing?.last_seen_at ?? null
      const lastSeenAt = newSuccessDate && (!priorSuccessDate || newSuccessDate > priorSuccessDate)
        ? newSuccessDate
        : priorSuccessDate

      const newFailureDate = s._latestFailure
        ? new Date(`${s._latestFailure}T12:00:00Z`).toISOString()
        : null

      // A success always wins and clears the failure streak.
      const successIsNewerThanKnownFailure =
        newSuccessDate && (!existing?.last_failed_at || newSuccessDate > existing.last_failed_at)

      let failedAttemptCount = existing?.failed_attempt_count ?? 0
      let lastFailedAt = existing?.last_failed_at ?? null

      if (successIsNewerThanKnownFailure) {
        failedAttemptCount = 0
        lastFailedAt = null
      } else if (newFailureDate && newFailureDate !== lastFailedAt) {
        const isAfterLastSuccess = !lastSeenAt || newFailureDate > lastSeenAt
        if (isAfterLastSuccess) {
          failedAttemptCount += 1
          lastFailedAt = newFailureDate
        }
      }

      // The rule: 2+ failed attempts AND no success in 30 days.
      // A single retry never flips the badge.
      const showFailedWarning = failedAttemptCount >= 2 && daysSince(lastSeenAt) > 30

      const row = {
        user_id: user.id,
        service_name: s.service_name,
        amount: s.amount ?? existing?.amount ?? null,
        amount_source: s.amount != null ? s.amount_source : (existing?.amount_source ?? null),
        currency: s.currency ?? existing?.currency ?? 'USD',
        billing_cycle: s.billing_cycle,
        cancel_url: s.cancel_url ?? existing?.cancel_url ?? null,
        confidence: s.confidence,
        rationale: s.rationale,
        source: s.source,
        domain: s.domain,
        last_seen_at: lastSeenAt,
        last_failed_at: lastFailedAt,
        failed_attempt_count: failedAttemptCount,
        decline_type: (s as any).decline_type ?? existing?.decline_type ?? null,
        last_payment_status: nextStatus === 'cancelled' ? 'success' : (showFailedWarning ? 'failed' : 'success'),
        status: nextStatus,
        cancelled_at: isCancelledByProvider
          ? new Date().toISOString()
          : nextStatus === 'active' ? null : existing?.cancelled_at ?? null,
      }

      if (existing) {
        await supabase.from('sr_detected_subscriptions').update(row).eq('id', existing.id)
      } else {
        await supabase.from('sr_detected_subscriptions').insert(row)
      }
    }

    return NextResponse.json({ ok: true, detected: finalAggregated.length, emailsScanned: details.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Scan failed'
    console.error('[SCAN] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
