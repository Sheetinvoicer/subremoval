import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Run on the Node.js runtime and always evaluate at request time so that
// environment variables (e.g. RESEND_API_KEY) are read at runtime instead of
// being evaluated during the build.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('Welcome email error: missing RESEND_API_KEY');
      return NextResponse.json(
        { error: 'Missing RESEND_API_KEY' },
        { status: 500 }
      );
    }

    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const resend = new Resend(resendApiKey);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data, error } = await resend.emails.send({
      from: 'SheetInvoicer <noreply@sheetinvoicer.com>',
      to: [email],
      subject: 'Welcome to SheetInvoicer!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to SheetInvoicer! 🎉</h1>
          <p>Hi ${name || 'there'},</p>
          <p>Thank you for signing up for SheetInvoicer. We're excited to help you manage your invoicing!</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>Create your first invoice</li>
            <li>Add your clients</li>
            <li>Set up your payment methods</li>
          </ul>
          <p>
            <a href="${appUrl}/dashboard" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Get Started
            </a>
          </p>
          <p style="color: #6B7280; font-size: 14px; margin-top: 40px;">
            If you have any questions, reply to this email or contact our support team.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to send welcome email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Welcome email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
