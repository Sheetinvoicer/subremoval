import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const frequencyToDays = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
}

function getNextDate(currentDate, frequency) {
  const nextDate = new Date(currentDate)
  const increment = frequencyToDays[frequency] || 30
  nextDate.setDate(nextDate.getDate() + increment)
  return nextDate.toISOString().split('T')[0]
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]
    const supabase = createClient()

    const { data: templates, error: templatesError } = await supabase
      .from('recurring_invoices')
      .select('*, clients(name, email)')
      .eq('status', 'active')
      .lte('next_date', today)

    if (templatesError) {
      return NextResponse.json({ error: templatesError.message }, { status: 500 })
    }

    const results = []

    for (const template of templates || []) {
      const { data: createdInvoice, error: createError } = await supabase
        .from('invoices')
        .insert({
          user_id: template.user_id,
          client_id: template.client_id,
          invoice_number: `INV-${Date.now()}-${String(template.id).slice(0, 6)}`,
          subtotal: template.amount,
          tax_rate_percentage: 0,
          tax_amount: 0,
          total: template.amount,
          currency: template.currency || 'USD',
          due_date: getNextDate(today, template.frequency),
          notes: template.notes || null,
          status: 'sent',
          recurring_template_id: template.id,
        })
        .select('id, invoice_number')
        .single()

      if (createError) {
        results.push({ templateId: template.id, success: false, error: createError.message })
        continue
      }

      const nextDate = getNextDate(today, template.frequency)
      const { error: updateError } = await supabase
        .from('recurring_invoices')
        .update({
          last_generated_at: new Date().toISOString(),
          next_date: nextDate,
        })
        .eq('id', template.id)

      if (updateError) {
        results.push({ templateId: template.id, success: false, error: updateError.message })
        continue
      }

      if (template.clients?.email && process.env.RESEND_API_KEY) {
        try {
          await resend.emails.send({
            from: 'SheetInvoicer <noreply@sheetinvoicer.com>',
            to: [template.clients.email],
            subject: `New invoice ${createdInvoice.invoice_number}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px;"><h2>New Invoice Created</h2><p>Hi ${template.clients.name || 'there'}, your recurring invoice <strong>${createdInvoice.invoice_number}</strong> has been generated.</p><p>Amount: ${template.currency || 'USD'} ${Number(template.amount || 0).toFixed(2)}</p><a href="${process.env.NEXT_PUBLIC_APP_URL}/pay/${createdInvoice.id}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Invoice</a></div>`,
          })
        } catch (emailError) {
          console.error('Recurring invoice email error:', emailError)
        }
      }

      results.push({ templateId: template.id, invoiceId: createdInvoice.id, success: true })
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Generate recurring cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
