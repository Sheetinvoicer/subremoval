import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Use type assertion to handle both real and mock client
    const result = await (supabase
      .from('invoices')
      .select('*, clients(name, email)')
      .eq('status', 'unpaid')
      .eq('due_date', today) as any);

    // Handle the result
    const invoices = result?.data || [];
    const error = result?.error || null;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const results = [];
    for (const invoice of invoices) {
      try {
        await resend.emails.send({
          from: 'SheetInvoicer <noreply@sheetinvoicer.com>',
          to: [invoice.clients.email],
          subject: `Invoice ${invoice.invoice_number} is due today`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2>Payment Reminder</h2>
              <p>Dear ${invoice.clients.name},</p>
              <p>Your invoice <strong>${invoice.invoice_number}</strong> is due today.</p>
              <p>Amount: ${invoice.currency} ${invoice.amount}</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.id}" 
                 style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Pay Now
              </a>
            </div>
          `,
        });
        results.push({ invoiceId: invoice.id, success: true });
      } catch (err) {
        console.error('Email error:', err);
        results.push({ invoiceId: invoice.id, success: false, error: err });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      results 
    });
  } catch (error) {
    console.error('Cron error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
