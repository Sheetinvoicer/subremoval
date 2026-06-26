import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/subscriptions/gate'
import { FEATURES } from '@/lib/subscriptions/plans'

// Accepts bare domains like "acme.com" or "team.acme.co.uk".
function isValidDomain(domain) {
  return typeof domain === 'string' && /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i.test(domain)
}

async function getAuthedUser(supabase) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

// GET — list the owner's registered SSO domains.
export async function GET() {
  try {
    const supabase = await createClient()
    const user = await getAuthedUser(supabase)
    if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })

    const gate = await requireFeature(supabase, user.id, FEATURES.SSO)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'SSO is available on the Business and Enterprise plans.', code: 'feature_locked', plan: gate.plan },
        { status: 403 },
      )
    }

    const { data, error } = await supabase
      .from('sso_connections')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ connections: data || [], plan: gate.plan })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load SSO connections' },
      { status: 500 },
    )
  }
}

// POST — register an SSO domain (Business+). The record is created as
// `pending`; an administrator completes identity-provider provisioning in
// Supabase Auth (SAML/OIDC) and the connection is activated.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const domain = String(body?.domain || '').trim().toLowerCase()

    if (!isValidDomain(domain)) {
      return NextResponse.json({ error: 'A valid company domain is required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthedUser(supabase)
    if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })

    const gate = await requireFeature(supabase, user.id, FEATURES.SSO)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'SSO is available on the Business and Enterprise plans.', code: 'feature_locked', plan: gate.plan },
        { status: 403 },
      )
    }

    const { data, error } = await supabase
      .from('sso_connections')
      .insert({ owner_id: user.id, domain, status: 'pending' })
      .select()
      .maybeSingle()

    if (error) {
      const status = error.code === '23505' ? 409 : 500
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    return NextResponse.json({ connection: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register SSO domain' },
      { status: 500 },
    )
  }
}

// DELETE — remove a registered SSO domain by id (?id=). Owner-scoped.
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'A connection id is required.' }, { status: 400 })

    const supabase = await createClient()
    const user = await getAuthedUser(supabase)
    if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })

    const { error } = await supabase
      .from('sso_connections')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove SSO domain' },
      { status: 500 },
    )
  }
}
