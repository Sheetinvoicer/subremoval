import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSubscriptionsFromStatement, normalizeName } from '@/lib/bank/scanner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    // === PAYWALL + SCAN LIMIT ===
    const { data: paidRow } = await supabase
      .from('sr_paid_users')
      .select('scan_count_this_month, scan_period_start')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!paidRow) {
      return NextResponse.json(
        { error: 'Lifetime access required. Buy for $4.99 to unlock scanning.', code: 'not_paid' },
        { status: 402 }
      )
    }

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
        },
        { status: 429 }
      )
    }

    // === Parse upload ===
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 400 })
    }

    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.pdf') && !lower.endsWith('.csv') && !lower.endsWith('.txt')) {
      return NextResponse.json(
        { error: 'Only PDF, CSV, and TXT files are supported.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (buffer.length < 100) {
      return NextResponse.json(
        { error: 'File appears to be empty or too small.' },
        { status: 400 }
      )
    }

    // Send to AI (Gemini reads PDFs directly, no text extraction needed)
    const detected = await extractSubscriptionsFromStatement(buffer, file.name)
    if (detected.length === 0) {
      return NextResponse.json({
        ok: true,
        detected: 0,
        message: 'No recurring subscriptions found in this statement.',
      })
    }

    // === INCREMENT COUNTER ===
    await supabase
      .from('sr_paid_users')
      .update({
        scan_count_this_month: currentCount + 1,
        scan_period_start: isNewMonth ? now.toISOString().slice(0, 10) : paidRow.scan_period_start,
      })
      .eq('user_id', user.id)

    // === UPSERT to sr_detected_subscriptions ===
    const { data: existingRows } = await supabase
      .from('sr_detected_subscriptions')
      .select('id, service_name, status, amount, currency, cancel_url')
      .eq('user_id', user.id)

    const existingByName = new Map(
      (existingRows ?? []).map((r) => [normalizeName(r.service_name), r])
    )

    let inserted = 0
    let updated = 0

    for (const s of detected) {
      const key = normalizeName(s.service_name)
      const existing = existingByName.get(key)

      if (existing?.status === 'dismissed') continue

      const row = {
        user_id: user.id,
        service_name: s.service_name,
        amount: s.amount ?? existing?.amount ?? null,
        amount_source: s.amount != null ? s.amount_source : null,
        currency: s.currency ?? existing?.currency ?? 'USD',
        billing_cycle: s.billing_cycle,
        cancel_url: s.cancel_url ?? existing?.cancel_url ?? null,
        confidence: s.confidence,
        rationale: s.rationale,
        source: s.source,
        domain: s.domain,
        last_seen_at: s.last_charged_date
          ? new Date(`${s.last_charged_date}T12:00:00Z`).toISOString()
          : new Date().toISOString(),
        last_failed_at: null,
        failed_attempt_count: 0,
        last_payment_status: 'success',
        status: existing?.status ?? 'active',
      }

      if (existing) {
        const { error } = await supabase
          .from('sr_detected_subscriptions')
          .update(row)
          .eq('id', existing.id)
        if (!error) updated++
      } else {
        const { error } = await supabase
          .from('sr_detected_subscriptions')
          .insert(row)
        if (!error) inserted++
      }
    }

    return NextResponse.json({
      ok: true,
      detected: detected.length,
      inserted,
      updated,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    console.error('[BANK UPLOAD]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
