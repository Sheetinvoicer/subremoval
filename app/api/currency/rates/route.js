import { NextResponse } from 'next/server'

const EXCHANGE_RATES_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

let cachedPayload = null

function isValidRatesPayload(payload) {
  return Boolean(
    payload
      && payload.base
      && payload.rates
      && typeof payload.rates === 'object'
      && Object.keys(payload.rates).length > 0
  )
}

export async function GET() {
  try {
    const now = Date.now()

    if (cachedPayload && now - cachedPayload.fetchedAt < ONE_DAY_MS) {
      return NextResponse.json(
        {
          ...cachedPayload.data,
          cached: true,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
          },
        }
      )
    }

    const response = await fetch(EXCHANGE_RATES_URL, {
      next: { revalidate: 86400 },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch exchange rates (${response.status})` },
        { status: 502 }
      )
    }

    const payload = await response.json()

    if (!isValidRatesPayload(payload)) {
      return NextResponse.json({ error: 'Invalid exchange rate response format' }, { status: 502 })
    }

    const normalized = {
      base: payload.base,
      date: payload.date || new Date().toISOString().slice(0, 10),
      rates: payload.rates,
      fetchedAt: now,
      source: EXCHANGE_RATES_URL,
    }

    cachedPayload = {
      fetchedAt: now,
      data: normalized,
    }

    return NextResponse.json(normalized, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while loading exchange rates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
