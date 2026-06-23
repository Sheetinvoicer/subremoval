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

export default async function proxy(request: NextRequest) {
  const localePrefixRegex = new RegExp(`^\/(${routing.locales.join('|')})(?=\/|$)`)
  if (routing.localePrefix === 'never' && localePrefixRegex.test(request.nextUrl.pathname)) {
    const pathnameWithoutLocale = request.nextUrl.pathname.replace(localePrefixRegex, '') || '/'
    const redirectUrl = new URL(pathnameWithoutLocale, request.url)
    redirectUrl.search = request.nextUrl.search
    return NextResponse.redirect(redirectUrl)
  }

  // Keep a mutable response so that any session cookies Supabase refreshes while
  // validating the user are written back to BOTH the forwarded request and the
  // browser. Without this the browser keeps a stale/expired auth cookie and the
  // API ends up seeing a different (or no) session than the browser — exactly
  // the "session not shared" symptom this fixes.
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run code between creating the client and calling
  // getUser(). getUser() validates the token with Supabase and triggers the
  // cookie refresh handled by `setAll` above, keeping the browser session and
  // the server/API session in sync.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = getPathWithoutLocale(request.nextUrl.pathname)
  const requiredRole = getRoleRequirement(pathname)

  if (requiredRole) {
    let userRole: string | null = null
    if (user) {
      // Email-based admin bootstrap mirrors lib/auth/roles so the designated
      // owner is recognised as admin even without a stored `admin` role.
      if (isAdminEmail(user.email)) {
        userRole = ROLES.ADMIN
      } else {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        userRole = data?.role ?? null
      }
    }

    if (!userRole || !hasRequiredRole(userRole, requiredRole)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)']
}
