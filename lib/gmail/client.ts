// Minimal Gmail OAuth + API helper. No external SDK — uses fetch only.

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
  id_token?: string
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }

  return res.json()
}

export async function getGmailUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.email ?? null
}
