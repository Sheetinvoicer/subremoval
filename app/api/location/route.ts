import { NextResponse } from 'next/server'
import { getCurrencyForCountry } from '@/lib/location'
import { getTaxInfo } from '@/lib/tax'

// IP-based geolocation via the free ipapi.co service. The route reads the
// caller's IP from the forwarded headers, asks ipapi.co for the matching
// country/currency, and enriches the response with our own currency mapping
// and tax-rate database so the client receives a complete smart-default
// suggestion in a single round trip.

const IPAPI_BASE = 'https://ipapi.co'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

interface CachedLocation {
  fetchedAt: number
  data: Record<string, unknown>
}

// Per-IP in-memory cache to stay within ipapi.co's free-tier limits.
const cache = new Map<string, CachedLocation>()

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // May be a comma-separated list "client, proxy1, proxy2".
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

function isPrivateOrLocalIp(ip: string | null): boolean {
  if (!ip) return true
  if (ip === '::1' || ip.startsWith('127.') || ip === 'localhost') return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true
  // 172.16.0.0 – 172.31.255.255
  const match = /^172\.(\d{1,3})\./.exec(ip)
  if (match) {
    const second = Number(match[1])
    if (second >= 16 && second <= 31) return true
  }
  // IPv6 unique local addresses.
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true
  return false
}

function buildPayload(raw: Record<string, unknown>) {
  const countryCode = String(raw.country_code || raw.country || '').toUpperCase()
  const tax = getTaxInfo(countryCode)
  // Prefer our own country->currency mapping; fall back to ipapi's currency.
  const currency =
    getCurrencyForCountry(countryCode) ||
    (typeof raw.currency === 'string' ? raw.currency : 'USD')

  return {
    detected: true,
    ip: raw.ip ?? null,
    countryCode,
    countryName: raw.country_name ?? null,
    region: raw.region ?? null,
    city: raw.city ?? null,
    currency,
    currencyFromProvider: raw.currency ?? null,
    tax: {
      type: tax.type,
      rate: tax.rate,
      name: tax.name,
    },
    source: 'ipapi.co',
  }
}

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request)
    const cacheKey = clientIp || 'self'
    const now = Date.now()

    const cached = cache.get(cacheKey)
    if (cached && now - cached.fetchedAt < SIX_HOURS_MS) {
      return NextResponse.json(
        { ...cached.data, cached: true },
        { headers: { 'Cache-Control': 'private, max-age=3600' } }
      )
    }

    // For reserved/local IPs we can't geolocate a specific address, so let
    // ipapi.co resolve the request's own public IP instead.
    const url = isPrivateOrLocalIp(clientIp)
      ? `${IPAPI_BASE}/json/`
      : `${IPAPI_BASE}/${encodeURIComponent(clientIp as string)}/json/`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'SubRemoval/1.0 (+https://www.subremoval.com)' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { detected: false, error: `Location provider error (${response.status})` },
        { status: 502 }
      )
    }

    const raw = (await response.json()) as Record<string, unknown>

    // ipapi.co reports failures with `{ error: true, reason: '...' }`.
    if (raw.error) {
      return NextResponse.json(
        { detected: false, error: String(raw.reason || 'Location could not be detected') },
        { status: 502 }
      )
    }

    const payload = buildPayload(raw)
    cache.set(cacheKey, { fetchedAt: now, data: payload })

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error while detecting location'
    return NextResponse.json({ detected: false, error: message }, { status: 500 })
  }
}
