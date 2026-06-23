import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 },
      );
    }

    const supabase = createClient();

    const origin =
      request.headers.get('origin') ||
      new URL(request.url).origin;

    const auth = supabase.auth as unknown as {
      resetPasswordForEmail: (
        email: string,
        options?: { redirectTo?: string },
      ) => Promise<{ error: { message: string } | null }>;
    };

    const { error } = await auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/update-password`,
    });

    if (error) {
      console.error('Reset password error:', error.message);
    }

    // Always return success generically to avoid leaking whether the
    // account exists.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to send reset email';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
