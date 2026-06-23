import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      const status = error.message === 'Auth session missing!' ? 401 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ 
      session: user ? {
        user: user,
      } : null 
    });
  } catch (error) {
    console.error('Session error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
