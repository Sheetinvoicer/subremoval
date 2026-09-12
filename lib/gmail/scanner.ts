import { GoogleGenAI, Type } from '@google/genai'
import { extractAmountFallback } from './amountFallback'
import { lookupKnownService } from './knownServices'

const SUBSCRIPTION_SENDERS = ['netflix.com','spotify.com','hulu.com','disneyplus.com','max.com','peacocktv.com','paramountplus.com','youtubepremium.com','adobe.com','dropbox.com','notion.so','figma.com','github.com','atlassian.net','atlassian.com','slack.com','zoom.us','canva.com','grammarly.com','1password.com','lastpass.com','jetbrains.com','openai.com','anthropic.com','midjourney.com','claude.ai','cursor.com','cursor.sh','vercel.com','railway.app','render.com','supabase.io','supabase.com','planetscale.com','neon.tech','audible.com','pandora.com','soundcloud.com','peloton.com','noom.com','headspace.com','calm.com','instacart.com','doordash.com','hellofresh.com','patreon.com','substack.com','nytimes.com','wsj.com','stripe.com','paddle.com','chargebee.com','recurly.com']
const BILLING_INFRA = ['stripe.com','paddle.com','chargebee.com','recurly.com']
const RECEIPT_SUBJECTS = ['receipt','subscription','renewal','invoice','billing','payment','charged','recurring','membership','auto-renew','auto renew','your plan','trial ends','trial ended','trial expires','payment received','payment confirmation']
const NOISE_SUBJECTS = ['security','verification','verify','sign-in','signin','alert','password','device','activity','welcome','introducing','newsletter','promotion','sale','deal','discount','coupon','survey','feedback','unsubscribe','shared some','shared google','data with']
const TEST_MARKERS = ['[staging]','[test]','[demo]','sandbox','test mode','localhost','127.0.0.1','example.com','placeholder']

const CANCEL_URL_KEYWORDS = /(cancel|unsubscribe|manage|billing|subscription|account|plans?|membership)/i
const BARE_DOMAIN = /^https?:\/\/(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/)?$/i

export type PaymentStatus = 'success' | 'failed' | 'cancelled_by_provider' | 'trial_ending' | 'unknown'
export type AmountSource = 'ai' | 'regex_fallback' | 'known_directory' | null

export interface CandidateLink { href: string; text: string }

export interface DetectedSubscription {
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
  amount_source: AmountSource
  payment_status: PaymentStatus
  is_recurring?: boolean
}

export interface EmailDetail {
  from: string | null
  to: string | null
  cc: string | null
  replyTo: string | null
  returnPath: string | null
  listUnsubscribe: string | null
  subject: string | null
  date: string | null
  dateIso: string | null
  body: string
  candidateLinks: CandidateLink[]
}

export interface KnownIdentifier { domain: string | null; businessName: string | null }

export async function searchSubscriptionEmails(accessToken: string): Promise<string[]> {
  const senderClause = SUBSCRIPTION_SENDERS.map((s) => `from:${s}`).join(' OR ')
  const noise = NOISE_SUBJECTS.map((k) => `-subject:"${k}"`).join(' ')
  const q1 = `newer_than:2y ((${senderClause}) ${noise})`
  const subjectClause = RECEIPT_SUBJECTS.map((k) => `subject:"${k}"`).join(' OR ')
  const q2 = `newer_than:2y ((${subjectClause}) ${noise})`
  const infraClause = BILLING_INFRA.map((s) => `from:${s}`).join(' OR ')
  const q3 = `newer_than:2y ((${infraClause}) ${noise})`
  const q4 = `newer_than:1y (subject:(receipt OR invoice OR renewal OR subscription) -subject:(security OR verification OR alert OR sign-in))`
  const results = await Promise.all([
    runGmailQuery(accessToken, q1, 50),
    runGmailQuery(accessToken, q2, 50),
    runGmailQuery(accessToken, q3, 30),
    runGmailQuery(accessToken, q4, 50),
  ])
  const seen = new Set<string>()
  const merged: string[] = []
  for (const list of results) for (const id of list) if (!seen.has(id)) { seen.add(id); merged.push(id) }
  console.log('[SCAN] Merged unique IDs:', merged.length)
  return merged
}

async function runGmailQuery(accessToken: string, query: string, limit: number): Promise<string[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(limit))
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.messages ?? []).map((m: { id: string }) => m.id)
}

function decodeBase64Url(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return Buffer.from(padded, 'base64').toString('utf-8')
  } catch { return '' }
}

function extractLinksFromHtml(html: string): CandidateLink[] {
  const links: CandidateLink[] = []
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRe.exec(html)) !== null) {
    const href = match[1].trim()
    const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!/^https?:\/\//i.test(href)) continue
    if (CANCEL_URL_KEYWORDS.test(href) || CANCEL_URL_KEYWORDS.test(text)) {
      links.push({ href, text: text || '(no text)' })
    }
  }
  const seen = new Set<string>()
  const deduped: CandidateLink[] = []
  for (const l of links) {
    if (seen.has(l.href)) continue
    seen.add(l.href)
    deduped.push(l)
    if (deduped.length >= 8) break
  }
  return deduped
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
}

function extractBodyAndLinks(payload: any): { text: string; links: CandidateLink[] } {
  if (!payload) return { text: '', links: [] }
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data)
    if (payload.mimeType === 'text/plain') return { text: raw, links: [] }
    if (payload.mimeType === 'text/html') return { text: htmlToPlainText(raw), links: extractLinksFromHtml(raw) }
  }
  if (Array.isArray(payload.parts)) {
    let plain = ''
    let links: CandidateLink[] = []
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) plain = decodeBase64Url(part.body.data)
      if (part.mimeType === 'text/html' && part.body?.data) {
        const raw = decodeBase64Url(part.body.data)
        links = extractLinksFromHtml(raw)
        if (!plain) plain = htmlToPlainText(raw)
      }
    }
    if (plain || links.length) return { text: plain, links }
    for (const part of payload.parts) {
      const nested = extractBodyAndLinks(part)
      if (nested.text || nested.links.length) return nested
    }
  }
  return { text: '', links: [] }
}

function parseDateHeader(dateHeader: string | null): string | null {
  if (!dateHeader) return null
  try {
    const d = new Date(dateHeader)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  } catch { return null }
}

export async function getMessageDetails(accessToken: string, messageId: string): Promise<EmailDetail | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return null
  const data = await res.json()
  const headers = data.payload?.headers ?? []
  const get = (name: string) =>
    headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null

  const { text, links } = extractBodyAndLinks(data.payload)
  let body = text.trim()
  if (!body) body = data.snippet ?? ''
  if (body.length > 5000) body = body.slice(0, 5000)

  const dateHeader = get('Date')
  return {
    from: get('From'), to: get('To'), cc: get('Cc'),
    replyTo: get('Reply-To'), returnPath: get('Return-Path'),
    listUnsubscribe: get('List-Unsubscribe'),
    subject: get('Subject'), date: dateHeader, dateIso: parseDateHeader(dateHeader),
    body, candidateLinks: links,
  }
}

function extractDomain(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  return match ? match[1].toLowerCase() : null
}

function looksSelfGenerated(
  email: EmailDetail, userEmail: string,
  excludedDomains: Set<string>, identifiers: KnownIdentifier[] = [],
): { self: boolean; reason?: string } {
  const userDomain = userEmail.split('@')[1]?.toLowerCase()
  const userEmailLower = userEmail.toLowerCase()
  const fromDomain = extractDomain(email.from)
  if (fromDomain && excludedDomains.has(fromDomain)) return { self: true, reason: `excluded domain: ${fromDomain}` }

  const combined = `${email.subject ?? ''} ${email.body}`.toLowerCase()
  for (const marker of TEST_MARKERS) if (combined.includes(marker)) return { self: true, reason: `test marker: ${marker}` }

  for (const id of identifiers) {
    if (id.domain && fromDomain === id.domain.toLowerCase()) return { self: true, reason: `known own domain: ${id.domain}` }
    if (id.businessName && combined.includes(id.businessName.toLowerCase())) return { self: true, reason: `known own business: ${id.businessName}` }
  }

  const toLower = (email.to ?? '').toLowerCase()
  const ccLower = (email.cc ?? '').toLowerCase()
  const userIsRecipient = toLower.includes(userEmailLower)

  if (!userIsRecipient && ccLower.includes(userEmailLower)) return { self: true, reason: 'user only in Cc, not To' }
  if (!userIsRecipient) {
    if (fromDomain && fromDomain === userDomain) return { self: true, reason: 'sender domain matches user domain' }
    const replyDomain = extractDomain(email.replyTo)
    if (replyDomain && fromDomain && replyDomain === fromDomain && !toLower.includes('@gmail.com')) {
      return { self: true, reason: 'Reply-To matches From and user not in To' }
    }
  }
  return { self: false }
}

function sanitizeCancelUrl(url: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  if (BARE_DOMAIN.test(trimmed)) return null
  if (!CANCEL_URL_KEYWORDS.test(trimmed)) return null
  return trimmed
}

export async function extractSubscriptionsFromBatch(
  emails: EmailDetail[], userEmail: string,
  excludedDomains: Set<string>, identifiers: KnownIdentifier[] = [],
): Promise<DetectedSubscription[]> {
  if (emails.length === 0) return []
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  const filtered: EmailDetail[] = []
  for (const e of emails) {
    const check = looksSelfGenerated(e, userEmail, excludedDomains, identifiers)
    if (check.self) { console.log('[SCAN] SKIP:', (e.subject ?? '').slice(0, 50), '—', check.reason); continue }
    filtered.push(e)
  }
  if (filtered.length === 0) return []

  const ai = new GoogleGenAI({ apiKey })

  const emailList = filtered.map((e, i) => {
    const linksBlock = e.candidateLinks.length
      ? e.candidateLinks.map((l, li) => `  [${li + 1}] "${l.text}" -> ${l.href}`).join('\n')
      : '  (no candidate links found in this email)'
    return `=== EMAIL ${i + 1} ===
From: ${e.from ?? 'unknown'}
To: ${e.to ?? 'unknown'}
Subject: ${e.subject ?? 'unknown'}
Candidate links:
${linksBlock}
Body:
${e.body}
=== END EMAIL ${i + 1} ===`
  }).join('\n\n')

  const prompt = `You classify emails to find PAID RECURRING SUBSCRIPTIONS the user is being charged for.

The user's email is: ${userEmail}

=== STEP 1 - RELATIONSHIP CHECK ===
For each email, decide:
  (A) USER IS THE CUSTOMER - receipt/invoice/renewal notice for a service the user pays for.
  (B) USER IS THE MERCHANT - user SENT this email, or notification about user's own customers.
  (C) NOT A SUBSCRIPTION - one-time purchase, physical order, non-recurring charge.
  (D) NOT A PAYMENT - newsletter, security alert, marketing, shipping update.

Return ONLY emails matching (A). Skip (B), (C), (D) entirely.

=== STEP 2 - SUBSCRIPTION CHECK ===
A subscription is a RECURRING charge. Confirming signals:
  YES: "monthly", "annual", "renewal", "recurring", "your plan", "next billing date"
  YES: the service is a known subscription (Netflix, Spotify, SaaS, cloud tools)
  NO: one-time purchases ("Your order shipped", "Download your purchase")

=== STEP 3 - EXTRACT FIELDS ===
For each (A) email:

- service_name: Clean brand name only. "Netflix", not "Netflix Inc. Receipt". "Vercel", not "Vercel invoice for September".
- domain: Brand's primary domain, no www, no path. "vercel.com", not "https://vercel.com/billing".
- amount: The charge AMOUNT as a number. Critical rules:
    - Prefer the TOTAL charged (after tax, before discount).
    - Look in: subject line, "Total", "Amount charged", "You paid", invoice tables.
    - If email shows subtotal AND total -> use TOTAL.
    - If plan is yearly but you can compute monthly -> use MONTHLY (yearly / 12).
    - Sanity: subscriptions are $1-$500. Return null if outside range.
    - Return null if you truly cannot find a number (do NOT guess).
- currency: "USD" (default), "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL".
- billing_cycle: "monthly" (default), "yearly", "quarterly", "weekly".
- cancel_link_index: from the "Candidate links" list, choose THE ONE that says:
    Priority: "Cancel subscription" > "Manage subscription" > "Billing settings" > "Account settings"
    If none fit -> null. NEVER invent URLs.
- source: "Stripe receipt" | "Direct billing" | "PayPal" | "App Store" | "Google Play" | "Other".
- confidence:
    "high" = clear recurring charge with amount found.
    "medium" = missing amount, missing cycle, or ambiguous sender.
    "low" = probably not a subscription.
- rationale: 1 sentence, max 120 chars, explaining your choice.
- payment_status - EXACT rules (this drives the "last payment failed" badge):
    "success" = money WAS charged. Signals: "receipt", "payment received", "charged $X", "invoice paid", "thanks for your payment".
    "failed" = a charge ATTEMPT failed. Signals: "payment failed", "card declined", "we couldn't process", "action required", "update your payment method".
    "cancelled_by_provider" = subscription ended. Signals: "your subscription ended", "we've cancelled", "account closed".
    "trial_ending" = free trial about to convert. Signals: "your trial ends in X days", "trial converts on".
    "unknown" = none of the above.
- event_date: date of THIS email (YYYY-MM-DD). Already provided if available.

=== STEP 4 - DEDUP INSTRUCTION ===
Return ALL matching emails, even multiple per service. Do not deduplicate yourself -
we aggregate successes over failures in our own code.

=== EXAMPLES ===
Input: "Your Vercel invoice for September" from billing@vercel.com, body contains "$20.00 total, invoice paid"
Output: { service_name: "Vercel", domain: "vercel.com", amount: 20, currency: "USD", billing_cycle: "monthly", source: "Direct billing", confidence: "high", payment_status: "success", rationale: "Vercel Pro monthly invoice, $20 charged" }

Input: "Your card was declined" from billing@vercel.com, "$20.00 payment failed"
Output: { service_name: "Vercel", domain: "vercel.com", amount: 20, currency: "USD", billing_cycle: "monthly", payment_status: "failed", rationale: "Vercel payment failed, card declined" }

Input: "Your Netflix receipt" from info@netflix.com, "$22.99 charged monthly"
Output: { service_name: "Netflix", domain: "netflix.com", amount: 22.99, currency: "USD", billing_cycle: "monthly", source: "Direct billing", confidence: "high", payment_status: "success", rationale: "Netflix monthly subscription charge" }

=== EMAILS TO CLASSIFY ===
${emailList}`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              email_index: { type: Type.NUMBER },
              service_name: { type: Type.STRING },
              domain: { type: Type.STRING, nullable: true },
              amount: { type: Type.NUMBER, nullable: true },
              currency: { type: Type.STRING, nullable: true },
              billing_cycle: { type: Type.STRING, nullable: true },
              cancel_link_index: { type: Type.NUMBER, nullable: true },
              source: { type: Type.STRING, nullable: true },
              confidence: { type: Type.STRING, nullable: true },
              rationale: { type: Type.STRING, nullable: true },
              payment_status: { type: Type.STRING, nullable: true },
            },
            required: ['email_index', 'service_name'],
          },
        },
      },
    })

    const text = response.text
    if (!text) return []
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((p) => p && typeof p.service_name === 'string' && typeof p.email_index === 'number')
      .map((p) => {
        const source = filtered[p.email_index - 1]
        const event_date = source?.dateIso ?? null

        const payment_status: PaymentStatus = (
          ['success','failed','cancelled_by_provider','trial_ending','unknown'].includes(p.payment_status)
            ? p.payment_status : 'unknown'
        ) as PaymentStatus

        const last_charged_date = payment_status === 'success' ? event_date : null

        let cancel_url: string | null = null
        if (typeof p.cancel_link_index === 'number' && source) {
          const chosen = source.candidateLinks[p.cancel_link_index - 1]
          cancel_url = chosen ? sanitizeCancelUrl(chosen.href) : null
        }

        let amount = typeof p.amount === 'number' && p.amount <= 500 ? p.amount : null
        let currency = typeof p.currency === 'string' ? p.currency : 'USD'
        let amount_source: AmountSource = amount != null ? 'ai' : null

        if (amount == null && source) {
          const fb = extractAmountFallback(source.body)
          if (fb) {
            amount = fb.amount
            currency = fb.currency
            amount_source = 'regex_fallback'
          }
        }

        const domain = typeof p.domain === 'string' ? p.domain : null

        if (amount == null) {
          const known = lookupKnownService(domain)
          if (known?.typicalAmount != null) {
            amount = known.typicalAmount
            currency = known.typicalCurrency ?? 'USD'
            amount_source = 'known_directory'
          }
        }

        if (!cancel_url) {
          const known = lookupKnownService(domain)
          if (known) cancel_url = known.cancelUrl
        }

        return {
          service_name: String(p.service_name).trim(),
          amount,
          currency,
          amount_source,
          billing_cycle: typeof p.billing_cycle === 'string' ? p.billing_cycle : 'monthly',
          cancel_url,
          confidence: (['high','medium','low'].includes(p.confidence) ? p.confidence : 'medium') as 'high'|'medium'|'low',
          rationale: typeof p.rationale === 'string' ? p.rationale : '',
          source: typeof p.source === 'string' ? p.source : 'Other',
          domain,
          event_date,
          last_charged_date,
          payment_status,
        }
      })
  } catch (err) {
    console.error('Gemini batch failed:', err)
    return []
  }
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\b(inc|llc|ltd|corp|co|gmbh|sa|bv|s\.?r\.?o)\.?\b/g,'').replace(/[^a-z0-9]/g,'').trim()
}
