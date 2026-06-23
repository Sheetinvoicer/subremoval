import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 })
    }

    const { invoiceId, invoiceIds } = await request.json()
    const normalizedInvoiceIds = Array.from(
      new Set(
        (Array.isArray(invoiceIds) ? invoiceIds : [invoiceId])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    )

    if (normalizedInvoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoiceId or invoiceIds is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resend = new Resend(resendApiKey)
    const results = []

    for (const currentInvoiceId of normalizedInvoiceIds) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, currency, due_date, notes, status, clients(name,email)')
        .eq('id', currentInvoiceId)
        .single()

      if (invoiceError || !invoice) {
        results.push({
          invoiceId: currentInvoiceId,
          success: false,
          error: invoiceError?.message || 'Invoice not found',
        })
        continue
      }

      const clientEmail = invoice.clients?.email
      if (!clientEmail) {
        results.push({
          invoiceId: currentInvoiceId,
          success: false,
          error: 'Client email is missing for this invoice',
        })
        continue
      }

      const paymentUrl = `${appUrl}/pay/${invoice.id}`
      const { error: sendError } = await resend.emails.send({
        from: 'SheetInvoicer <noreply@sheetinvoicer.com>',
        to: [clientEmail],
        subject: `Invoice ${invoice.invoice_number}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
            <h2>Invoice ${invoice.invoice_number}</h2>
            <p>Hello ${invoice.clients?.name || 'there'},</p>
            <p>You have received a new invoice.</p>
            <p><strong>Amount:</strong> ${invoice.currency || 'USD'} ${Number(invoice.total || 0).toFixed(2)}</p>
            <p><strong>Due date:</strong> ${invoice.due_date || 'N/A'}</p>
            ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
            <p><a href="${paymentUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View invoice</a></p>
            <p>Thanks,<br/>SheetInvoicer</p>
          </div>
        `,
      })

      if (sendError) {
        results.push({
          invoiceId: currentInvoiceId,
          success: false,
          error: sendError.message || 'Failed to send email',
        })
        continue
      }

      await supabase.from('invoices').update({ status: invoice.status === 'paid' ? 'paid' : 'sent' }).eq('id', invoice.id)

      results.push({
        invoiceId: currentInvoiceId,
        success: true,
      })
    }

    const sent = results.filter((result) => result.success).length
    const failed = results.length - sent

    if (results.length === 1) {
      if (failed > 0) {
        return NextResponse.json({ error: results[0].error || 'Failed to send email' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({
      success: failed === 0,
      total: results.length,
      sent,
      failed,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error while sending invoice' },
      { status: 500 },
    )
  }
}