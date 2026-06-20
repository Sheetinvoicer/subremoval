import { NextRequest, NextResponse } from "next/server";
import React from 'react';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, clientEmail, clientName, invoiceNumber, amount, currency } = await request.json();
    
    console.log('Sending magic link for invoice:', invoiceId, 'to:', clientEmail);
    
    const token = crypto.randomUUID();
    const supabase = await createClient();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const { error: insertError } = await supabase.from('client_sessions').insert({
      client_email: clientEmail,
      token: token,
      expires_at: expiresAt.toISOString()
    });
    
    if (insertError) {
      console.error('Insert error:', insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }
    
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${token}`;
    
    await resend.emails.send({
      from: 'invoices@sheetinvoicer.com',
      to: clientEmail,
      subject: `Invoice ${invoiceNumber} from your business`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2>Hello ${clientName},</h2>
          <p>You have an invoice from <strong>Your Business</strong></p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
            <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
            <p><strong>Amount:</strong> ${currency} ${amount}</p>
          </div>
          <a href="${magicLink}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View & Pay Invoice</a>
          <p>This link expires in 7 days.</p>
        </div>
      `
    });
    
    return Response.json({ success: true, token });
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error instanceof Error ? error instanceof Error ? error.message : "Internal server error" : "Internal server error" }, { status: 500 });
  }
}
