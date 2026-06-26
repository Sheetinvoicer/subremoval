/**
 * AI-assisted invoice content generation.
 *
 * Calls Claude (the project's primary provider) through the official Anthropic
 * SDK to turn a short free-text brief into structured invoice line items plus an
 * optional notes/summary. Follows the `claude-api` skill guidance:
 *  - the frozen, deterministic instructions live in a `system` block marked with
 *    `cache_control: { type: 'ephemeral' }` so the prefix is cached across calls,
 *    while the only volatile content (the brief, currency, locale) goes in the
 *    user turn — keeping the cached prefix byte-stable;
 *  - the model is pinned to `claude-opus-4-6`.
 *
 * The model is instructed to return strict JSON which we parse defensively; the
 * pure `parseGeneratedInvoiceContent` is exported so it can be unit-tested
 * without the network.
 */
import Anthropic from '@anthropic-ai/sdk'

export const AI_INVOICE_MODEL = 'claude-opus-4-6'
const AI_TIMEOUT_MS = 60_000
const AI_MAX_RETRIES = 1
const AI_MAX_TOKENS = 2000

export const MAX_BRIEF_LENGTH = 2000
export const MAX_GENERATED_ITEMS = 12
export const MAX_NOTES_LENGTH = 240

// Frozen instructions → cacheable prefix. Do NOT interpolate per-request data
// here or the cache breakpoint is invalidated on every call.
export const INVOICE_AI_SYSTEM_PROMPT = `You are an expert invoicing assistant for a SaaS invoicing product.
Given a short free-text description of work performed, produce professional invoice line items and an optional short notes/summary.

Rules:
- Return ONLY a single JSON object. No markdown, no code fences, no commentary.
- JSON shape: {"items":[{"description":string,"quantity":number,"price":number}],"notes":string}
- "price" is the unit price (per single quantity) as a plain number in the invoice currency, with no currency symbols or thousands separators.
- Produce between 1 and ${MAX_GENERATED_ITEMS} concise, professional line items. Quantities must be positive; prices must be zero or positive and may be decimals.
- "notes" is a brief professional summary or payment note (at most ${MAX_NOTES_LENGTH} characters); use an empty string when none is warranted.
- Never include taxes, totals, or discounts as line items — those are computed separately by the application.
- Write all human-readable text in the requested language.`

export interface GeneratedInvoiceItem {
  description: string
  quantity: number
  price: number
}

export interface GeneratedInvoiceContent {
  items: GeneratedInvoiceItem[]
  notes: string
}

export interface GenerateInvoiceContentInput {
  brief: string
  currency?: string
  locale?: string
}

/** Thrown when the provider is not configured (e.g. no API key in the env). */
export class InvoiceAiUnavailableError extends Error {
  constructor(message = 'AI generation is not configured') {
    super(message)
    this.name = 'InvoiceAiUnavailableError'
  }
}

/** Builds the volatile user turn (kept out of the cached system prefix). */
export function buildInvoiceUserPrompt({ brief, currency = 'USD', locale = 'en' }: GenerateInvoiceContentInput): string {
  return [
    `Currency: ${currency}`,
    `Language (BCP-47): ${locale}`,
    'Description of work:',
    String(brief ?? '').trim(),
  ].join('\n')
}

function coerceItem(raw: unknown): GeneratedInvoiceItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const description = typeof r.description === 'string' ? r.description.trim() : ''
  const quantity = Number(r.quantity)
  const price = Number(r.price)
  if (!description) return null
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(price) || price < 0) return null
  return { description: description.slice(0, 300), quantity, price }
}

// Pulls the first balanced-looking JSON object out of the model text, tolerating
// stray prose or accidental code fences.
function extractJsonObject(text: string): string | null {
  if (typeof text !== 'string') return null
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  return cleaned.slice(start, end + 1)
}

/**
 * Parses + validates the model's JSON response into clean, app-ready content.
 * Throws when nothing usable can be extracted so callers can surface a clear
 * error and fall back to manual entry.
 */
export function parseGeneratedInvoiceContent(text: string): GeneratedInvoiceContent {
  const json = extractJsonObject(text)
  if (!json) throw new Error('The assistant did not return valid content')

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('The assistant returned malformed content')
  }

  const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const rawItems = Array.isArray(obj.items) ? obj.items : []
  const items = rawItems
    .map(coerceItem)
    .filter((item): item is GeneratedInvoiceItem => item !== null)
    .slice(0, MAX_GENERATED_ITEMS)

  if (items.length === 0) throw new Error('The assistant returned no usable line items')

  const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, MAX_NOTES_LENGTH) : ''
  return { items, notes }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new InvoiceAiUnavailableError()
  return new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: AI_MAX_RETRIES })
}

function extractText(message: Anthropic.Message): string {
  if (!message || !Array.isArray(message.content)) return ''
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

/**
 * Generates invoice line items + notes from a brief. Throws
 * `InvoiceAiUnavailableError` when no provider is configured, or a generic Error
 * when the provider fails or returns unusable content.
 */
export async function generateInvoiceContent(input: GenerateInvoiceContentInput): Promise<GeneratedInvoiceContent> {
  const brief = String(input.brief ?? '').trim()
  if (!brief) throw new Error('A description is required to generate invoice content')

  const client = getClient()
  const message = await client.messages.create({
    model: AI_INVOICE_MODEL,
    max_tokens: AI_MAX_TOKENS,
    temperature: 0.3,
    system: [{ type: 'text', text: INVOICE_AI_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: buildInvoiceUserPrompt({ ...input, brief: brief.slice(0, MAX_BRIEF_LENGTH) }),
      },
    ],
  })

  return parseGeneratedInvoiceContent(extractText(message))
}
