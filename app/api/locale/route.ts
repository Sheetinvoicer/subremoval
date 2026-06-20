import {NextResponse} from 'next/server'
import {routing} from '@/i18n/routing'

export async function POST(request: Request) {
  const {locale} = await request.json()

  if (!routing.locales.includes(locale)) {
    return NextResponse.json({error: 'Unsupported locale'}, {status: 400})
  }

  const response = NextResponse.json({ok: true})

  response.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })

  return response
}
