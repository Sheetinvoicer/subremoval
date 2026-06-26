import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscriptions/gate'
import { getLimit } from '@/lib/subscriptions/plans'

function isValidEmail(email) {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

// Seats available to invite = teamMembers limit - 1 (the owner holds one seat).
// A null limit means unlimited (Enterprise).
function invitableSeats(limit) {
  if (limit === null || limit === undefined) return null
  return Math.max(0, limit - 1)
}

async function getAuthedUser(supabase) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

// GET — list the current owner's team members and seat usage.
export async function GET() {
  try {
    const supabase = await createClient()
    const user = await getAuthedUser(supabase)
    if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })

    const plan = await getUserPlan(supabase, user.id)
    const seatLimit = getLimit(plan, 'teamMembers')

    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', user.id)
      .neq('status', 'revoked')
      .order('invited_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const used = (members?.length || 0) + 1 // include the owner
    return NextResponse.json({
      plan,
      members: members || [],
      seats: { used, limit: seatLimit, invitable: invitableSeats(seatLimit) },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load team' },
      { status: 500 },
    )
  }
}

// POST — invite a team member (creates a pending membership). Gated by the
// plan's seat limit; Free/Pro have a single seat so cannot invite.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()
    const role = ['member', 'admin', 'viewer'].includes(body?.role) ? body.role : 'member'

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthedUser(supabase)
    if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })

    const plan = await getUserPlan(supabase, user.id)
    const seatLimit = getLimit(plan, 'teamMembers')
    const maxInvites = invitableSeats(seatLimit)

    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .neq('status', 'revoked')

    const used = count || 0
    if (maxInvites !== null && used >= maxInvites) {
      return NextResponse.json(
        {
          error: 'Seat limit reached for your plan. Upgrade to invite more teammates.',
          code: 'seat_limit',
          plan,
          seats: { used: used + 1, limit: seatLimit, invitable: maxInvites },
        },
        { status: 403 },
      )
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({ owner_id: user.id, member_email: email, role, status: 'pending' })
      .select()
      .maybeSingle()

    if (error) {
      // Unique violation => already invited.
      const status = error.code === '23505' ? 409 : 500
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    return NextResponse.json({ member: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to invite teammate' },
      { status: 500 },
    )
  }
}

// DELETE — remove a team member by id (passed as ?id=). Owner-scoped (RLS also
// restricts to the owner's rows). Frees a seat immediately.
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'A member id is required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthedUser(supabase)
    if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove teammate' },
      { status: 500 },
    )
  }
}
