import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { createServerClient } from '@supabase/ssr'
import { hasRequiredRole, isAdminEmail, ROLES } from '@/lib/auth/roles'

const adminRouteMatchers = [/^\/dashboard\/admin(\/.*)?$/, /^\/api\/admin(\/.*)?$/]

const getRoleRequirement = (pathname: string) => {
  if (adminRouteMatchers.some((re) => re.test(pathname))) {
    return ROLES.ADMIN
  }
  return null
}

const getPathWithoutLocale = (pathname: string) => {
  const localePrefixRegex = new RegExp(`^\/(${routing.locales.join('|')})(?=\/|$)`)
  return pathname.replace(localePrefixRegex, '') || '/'
}

async function getCurrentRoleFromRequest(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Email-based admin bootstrap mirrors lib/auth/roles so the designated owner
  // is recognised as admin even without a stored `admin` role.
  if (isAdminEmail(user.email)) return ROLES.ADMIN

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return data?.role ?? null
}

export default async function middleware(request: NextRequest) {
  const localePrefixRegex = new RegExp(`^\/(${routing.locales.join('|')})(?=\/|$)`)
  if (routing.localePrefix === 'never' && localePrefixRegex.test(request.nextUrl.pathname)) {
    const pathnameWithoutLocale = request.nextUrl.pathname.replace(localePrefixRegex, '') || '/'
    const redirectUrl = new URL(pathnameWithoutLocale, request.url)
    redirectUrl.search = request.nextUrl.search
    return NextResponse.redirect(redirectUrl)
  }

  const pathname = getPathWithoutLocale(request.nextUrl.pathname)
  const requiredRole = getRoleRequirement(pathname)

  if (requiredRole) {
    const userRole = await getCurrentRoleFromRequest(request)
    if (!userRole || !hasRequiredRole(userRole, requiredRole)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)']
}
