import { GoogleGenAI, Type } from '@google/genai'

export interface BankSubscription {
  service_name: string
  amount: number | null
  currency: string | null
  billing_cycle: string | null
  cancel_url: string | null
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  source: string
  domain: string | null
  event_date: string | null
  last_charged_date: string | null
  amount_source: 'ai' | null
  payment_status: 'success'
}

const KNOWN_CANCEL_URLS: Record<string, string> = {
  netflix: 'https://www.netflix.com/cancelplan',
  spotify: 'https://www.spotify.com/account/subscription/',
  hulu: 'https://secure.hulu.com/account',
  disney: 'https://www.disneyplus.com/account',
  apple: 'https://support.apple.com/en-us/HT202039',
  amazon: 'https://www.amazon.com/mc',
  adobe: 'https://account.adobe.com/plans',
  dropbox: 'https://www.dropbox.com/account/plan',
  openai: 'https://platform.openai.com/account/billing',
  anthropic: 'https://console.anthropic.com/settings/billing',
  vercel: 'https://vercel.com/account/billing',
  github: 'https://github.com/settings/billing',
  notion: 'https://www.notion.so/my-account',
  figma: 'https://www.figma.com/settings',
  slack: 'https://slack.com/help/articles/218915077',
  jetbrains: 'https://account.jetbrains.com/licenses',
  microsoft: 'https://account.microsoft.com/services',
}

function guessDomain(name: string): string | null {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!clean) return null
  return `${clean}.com`
}

function guessCancelUrl(name: string, domain: string | null): string | null {
  const key = name.toLowerCase()
  for (const [k, url] of Object.entries(KNOWN_CANCEL_URLS)) {
    if (key.includes(k)) return url
  }
  if (domain) return `https://${domain}/account`
  return null
}

const PROMPT = `You are reading a bank or credit card statement (image or text).

TASK: Find every RECURRING SUBSCRIPTION charge.

RULES:
- Only include merchants that (a) appear 2+ times with same/similar amounts, OR (b) are well-known subscription services
- Skip one-time purchases (restaurants, gas, groceries, retail, ATM, transfers)
- Skip payments between accounts (credit card payments, transfers)
- Skip refunds, credits, reversals
- Clean merchant names:
  "NFLX*SUBSCRIPTION" -> "Netflix"
  "SPOTIFY AB" -> "Spotify"
  "APPLE.COM/BILL" -> "Apple"
  "AMZN PRIME" -> "Amazon Prime"
  "ADOBE *CREATIVE CLOUD" -> "Adobe Creative Cloud"
- If multiple charges for same service, return ONE entry with the most recent amount
- Never invent data you can't see

For each subscription, return:
- service_name (clean, capitalized)
- amount (positive number, monthly)
- currency (USD/EUR/GBP/etc)
- billing_cycle ("monthly" | "yearly" | "quarterly" | "weekly")
- event_date (last charge date, YYYY-MM-DD)
- confidence ("high" if 2+ matching charges OR known subscription, "medium" if unsure, "low" if guessing)
- rationale (1 sentence, max 100 chars)

Return ONLY a JSON array. If no subscriptions found, return [].`

export async function extractSubscriptionsFromStatement(
  buffer: Buffer,
  filename: string
): Promise<BankSubscription[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[BANK] Missing GEMINI_API_KEY')
    return []
  }

  const ai = new GoogleGenAI({ apiKey })
  const lower = filename.toLowerCase()

  // Build the content parts — PDFs as inlineData, CSVs/TXTs as text
  const parts: any[] = [{ text: PROMPT }]

  if (lower.endsWith('.pdf')) {
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: buffer.toString('base64'),
      },
    })
  } else {
    // CSV / TXT
    const text = buffer.toString('utf-8').slice(0, 100000)
    parts.push({ text: `STATEMENT TEXT:\n${text}` })
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              service_name: { type: Type.STRING },
              amount: { type: Type.NUMBER, nullable: true },
              currency: { type: Type.STRING, nullable: true },
              billing_cycle: { type: Type.STRING, nullable: true },
              event_date: { type: Type.STRING, nullable: true },
              confidence: { type: Type.STRING, nullable: true },
              rationale: { type: Type.STRING, nullable: true },
            },
            required: ['service_name'],
          },
        },
      },
    })

    const raw = response.text
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((p: any) => p && typeof p.service_name === 'string')
      .map((p: any) => {
        const amount = typeof p.amount === 'number' && p.amount > 0 && p.amount <= 500
          ? p.amount
          : null
        const domain = guessDomain(p.service_name)
        return {
          service_name: String(p.service_name).trim(),
          amount,
          currency: typeof p.currency === 'string' ? p.currency : 'USD',
          billing_cycle: typeof p.billing_cycle === 'string' ? p.billing_cycle : 'monthly',
          cancel_url: guessCancelUrl(p.service_name, domain),
          confidence: (['high', 'medium', 'low'].includes(p.confidence)
            ? p.confidence
            : 'medium') as 'high' | 'medium' | 'low',
          rationale: typeof p.rationale === 'string' ? p.rationale : 'Detected from statement',
          source: 'Bank statement',
          domain,
          event_date: typeof p.event_date === 'string' ? p.event_date : null,
          last_charged_date: typeof p.event_date === 'string' ? p.event_date : null,
          amount_source: amount != null ? 'ai' : null,
          payment_status: 'success' as const,
        }
      })
  } catch (e) {
    console.error('[BANK] Gemini error:', e instanceof Error ? e.message : e)
    return []
  }
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|sa|bv|s\.?r\.?o)\.?\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}
