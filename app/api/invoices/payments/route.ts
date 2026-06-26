import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { recordAuditLog } from '@/lib/audit/log'
import { computeBalance, isPaymentKind, roundMoney, type PaymentKind } from '@/lib/invoices/payments'

// Records a partial payment against an invoice, recomputes the running balance,
// auto-marks the invoice `paid` once it is settled, and appends an owner-visible
// `invoice_history` trail (with high-value events mirrored to `audit_logs`).
//
// Recording runs through this authenticated route (bearer-auth + token-scoped
// client, mirroring app/api/invoices/export/route.ts) so the history writes and
// audit mirroring stay centralized and secure; the detail page reads payments
// and history directly under RLS.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PaymentRequestBody {
  invoiceId?: string
  amount?: number | string
  kind?: string
  note?: string
  paidAt?: string
  currency?: string
}

function bearerToken(request: Request): string | undefined {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization')
  return authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined
}

export async function POST(request: Request) {
  try {
    const accessToken = bearerToken(request)
    const supabase = await createClient(accessToken)

    const {
      data: { user },
      error: userError,
    } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as PaymentRequestBody
    const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : ''
    const amount = roundMoney(Number(body.amount))
    const kind: PaymentKind = isPaymentKind(body.kind) ? body.kind : 'payment'
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }
    // Allow negative amounts (credits/adjustments) but never a no-op zero.
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: 'A non-zero amount is required' }, { status: 400 })
    }

    return await Sentry.startSpan(
      { name: 'invoices.payments.record', op: 'http.server', attributes: { kind } },
      async () => {
        // Load the invoice under RLS — a cross-user id simply resolves to null.
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('id, total, status, currency')
          .eq('user_id', user.id)
          .eq('id', invoiceId)
          .single()

        if (invoiceError || !invoice) {
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const currency =
          (typeof body.currency === 'string' && body.currency) || invoice.currency || 'USD'
        const paidAt =
          typeof body.paidAt === 'string' && body.paidAt ? body.paidAt : new Date().toISOString()

        // Insert the payment under RLS (the owner policy enforces user_id).
        const { data: payment, error: paymentError } = await supabase
          .from('invoice_payments')
          .insert({
            invoice_id: invoiceId,
            user_id: user.id,
            amount,
            currency,
            kind,
            note,
            paid_at: paidAt,
          })
          .select('id, amount, currency, kind, note, paid_at, created_at')
          .single()

        if (paymentError || !payment) {
          Sentry.captureException(paymentError || new Error('Payment insert failed'))
          return NextResponse.json(
            { error: paymentError?.message || 'Failed to record payment' },
            { status: 500 },
          )
        }

        // Recompute the balance from EVERY recorded entry for this invoice.
        const { data: allPayments, error: sumError } = await supabase
          .from('invoice_payments')
          .select('amount')
          .eq('user_id', user.id)
          .eq('invoice_id', invoiceId)

        if (sumError) {
          Sentry.captureException(sumError)
          return NextResponse.json({ error: sumError.message }, { status: 500 })
        }

        const { paid, balance, fullyPaid } = computeBalance(
          Number(invoice.total) || 0,
          allPayments || [],
        )

        // Append the payment to the owner-visible history trail.
        await supabase.from('invoice_history').insert({
          invoice_id: invoiceId,
          user_id: user.id,
          action: 'payment.recorded',
          before: null,
          after: { amount, kind, currency, paid, balance },
        })

        // Auto-mark paid once settled (and not already paid); log + audit it.
        let status: string = invoice.status
        if (fullyPaid && invoice.status !== 'paid') {
          const { error: statusError } = await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('user_id', user.id)
            .eq('id', invoiceId)

          if (statusError) {
            Sentry.captureException(statusError)
          } else {
            status = 'paid'
            await supabase.from('invoice_history').insert({
              invoice_id: invoiceId,
              user_id: user.id,
              action: 'invoice.paid',
              before: { status: invoice.status },
              after: { status: 'paid', paid, balance },
            })
            await recordAuditLog({
              action: 'invoice.paid',
              actor: { id: user.id, email: user.email },
              resourceType: 'invoice',
              resourceId: invoiceId,
              metadata: { paid, balance, currency },
              request,
            })
          }
        }

        // Mirror the payment itself to the admin audit trail (fire-and-forget).
        await recordAuditLog({
          action: 'invoice.payment_recorded',
          actor: { id: user.id, email: user.email },
          resourceType: 'invoice',
          resourceId: invoiceId,
          metadata: { amount, kind, currency, paid, balance, fullyPaid },
          request,
        })

        return NextResponse.json({ payment, paid, balance, fullyPaid, status }, { status: 201 })
      },
    )
  } catch (error) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : 'Failed to record payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
