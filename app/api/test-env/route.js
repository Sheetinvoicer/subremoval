import { NextResponse } from 'next/server';

export async function GET() {
  const keys = {
    stripe: !!process.env.STRIPE_SECRET_KEY,
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    resend: !!process.env.RESEND_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    supabaseService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  
  return NextResponse.json({ 
    message: "Environment check", 
    keys,
    allSet: Object.values(keys).every(v => v === true)
  });
}
