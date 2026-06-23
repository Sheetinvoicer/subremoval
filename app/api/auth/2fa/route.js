import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  createRememberDeviceToken,
  generateBackupCodes,
  generateQrCodeDataUrl,
  generateTotpSecret,
  useBackupCode,
  verifyRememberDeviceToken,
  verifyTotpToken,
} from '@/lib/auth/2fa'

const REMEMBER_COOKIE = 'remember_2fa_device'

async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action !== 'status') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { user } = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const twoFactor = user.user_metadata?.two_factor || {}
  const rememberToken = (await cookies()).get(REMEMBER_COOKIE)?.value

  return NextResponse.json({
    enabled: Boolean(twoFactor.enabled),
    rememberTrusted: verifyRememberDeviceToken(rememberToken, user.id),
    hasBackupCodes: Array.isArray(twoFactor.backup_codes) && twoFactor.backup_codes.length > 0,
  })
}

export async function POST(request) {
  const body = await request.json()
  const action = body?.action
  const { supabase, user } = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = user.user_metadata?.two_factor || {}

  if (action === 'setup') {
    const secret = generateTotpSecret(user.email || user.id)
    const qrCodeDataUrl = await generateQrCodeDataUrl(secret.otpauth_url)

    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        two_factor: {
          ...existing,
          secret: secret.base32,
          enabled: false,
          backup_codes: existing.backup_codes || [],
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    })
  }

  if (action === 'verify-setup') {
    const code = body?.code
    const secret = existing.secret
    if (!verifyTotpToken(code, secret)) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    const backup = generateBackupCodes()
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        two_factor: {
          ...existing,
          enabled: true,
          backup_codes: backup.hashedCodes,
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, backupCodes: backup.plainCodes })
  }

  if (action === 'disable') {
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        two_factor: {
          enabled: false,
          secret: null,
          backup_codes: [],
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete(REMEMBER_COOKIE)
    return response
  }

  if (action === 'verify-login') {
    const code = body?.code
    const rememberDevice = Boolean(body?.rememberDevice)

    const isTotpValid = verifyTotpToken(code, existing.secret)
    let isBackupValid = false
    let remainingBackupCodes = existing.backup_codes || []

    if (!isTotpValid) {
      const backup = useBackupCode(code, existing.backup_codes || [])
      isBackupValid = backup.valid
      remainingBackupCodes = backup.remainingHashedCodes
    }

    if (!isTotpValid && !isBackupValid) {
      return NextResponse.json({ error: 'Invalid authentication code' }, { status: 400 })
    }

    if (isBackupValid) {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          two_factor: {
            ...existing,
            backup_codes: remainingBackupCodes,
          },
        },
      })
    }

    const response = NextResponse.json({ success: true })

    if (rememberDevice) {
      const rememberToken = createRememberDeviceToken(user.id)
      response.cookies.set(REMEMBER_COOKIE, rememberToken, {
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      })
    }

    return response
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
