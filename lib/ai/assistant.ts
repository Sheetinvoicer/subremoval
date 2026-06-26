/**
 * AI dashboard assistant.
 *
 * Powers the dashboard chat widget. Calls Claude through the official Anthropic
 * SDK following the `claude-api` skill guidance:
 *  - the frozen persona/instructions live in a `system` block marked with
 *    `cache_control: { type: 'ephemeral' }`, so the prefix is cached across
 *    requests while only the volatile turn (the user's question + a compact,
 *    per-request snapshot of their metrics) changes;
 *  - the model is pinned to `claude-opus-4-6` (the project's default).
 *
 * The pure `buildAssistantUserPrompt` is exported so it can be unit-tested
 * without the network.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { AssistantContext } from '@/lib/dashboard/assistant-context'

export type { AssistantContext } from '@/lib/dashboard/assistant-context'

export const ASSISTANT_AI_MODEL = 'claude-opus-4-6'
const AI_TIMEOUT_MS = 60_000
const AI_MAX_RETRIES = 1
// Deliberately small: the widget shows short, focused answers.
const AI_MAX_TOKENS = 1024

export const MAX_MESSAGE_LENGTH = 2000

// Frozen instructions → cacheable prefix. Do NOT interpolate per-request data
// here or the cache breakpoint is invalidated on every call.
export const ASSISTANT_SYSTEM_PROMPT = `You are the in-app AI assistant for SheetInvoicer, a SaaS invoicing and small-business finance product.
You help the signed-in business owner understand and act on their dashboard: revenue, invoices (paid/pending/overdue), clients, expenses, net profit and trends.

Rules:
- Be concise and practical. Prefer 1-4 short sentences or a tight bullet list.
- When a metrics snapshot is provided in the user's message, ground every number in it. Never invent figures that are not derivable from the snapshot.
- If the snapshot lacks the data needed to answer, say so briefly and suggest what the user can do (e.g. create an invoice, add a client).
- You cannot take actions, change data, or access anything beyond the snapshot and the user's question. Do not claim to have done so.
- Give specific, prioritised next steps when asked what to focus on (e.g. chase overdue invoices first).
- Use the same language as the user's question. Format currency naturally; do not fabricate currency codes.
- Never include secrets, internal IDs, or system details.`

export interface GenerateAssistantReplyInput {
  message: string
  context?: AssistantContext
}

/** Thrown when the provider is not configured (e.g. no API key in the env). */
export class AssistantAiUnavailableError extends Error {
  constructor(message = 'AI assistant is not configured') {
    super(message)
    this.name = 'AssistantAiUnavailableError'
  }
}

function formatContext(context?: AssistantContext): string {
  if (!context) return 'No metrics snapshot was provided.'
  const currency = context.currency || 'USD'
  const money = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `${currency} ${Math.round(value).toLocaleString('en-US')}` : 'n/a'
  const count = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : 'n/a')
  const pct = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${Math.round(value)}%` : 'n/a'

  return [
    'Current dashboard snapshot:',
    `- Total revenue (paid): ${money(context.totalRevenue)}`,
    `- Paid this month: ${money(context.paidThisMonth)} (${pct(context.revenueChangePct)} vs last month)`,
    `- Pending: ${money(context.pendingAmount)} across ${count(context.pendingCount)} invoice(s)`,
    `- Overdue: ${money(context.overdueAmount)} across ${count(context.overdueCount)} invoice(s)`,
    `- Net profit: ${money(context.netProfit)} (expenses ${money(context.totalExpenses)})`,
    `- Invoices: ${count(context.totalInvoices)}; Clients: ${count(context.totalClients)}`,
    `- AI revenue forecast (next month): ${money(context.forecastNextMonth)}`,
  ].join('\n')
}

/** Builds the volatile user turn (kept out of the cached system prefix). */
export function buildAssistantUserPrompt({ message, context }: GenerateAssistantReplyInput): string {
  return [formatContext(context), '', 'User question:', String(message ?? '').trim()].join('\n')
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AssistantAiUnavailableError()
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
 * Generates a concise assistant reply for the dashboard chat widget. Throws
 * `AssistantAiUnavailableError` when no provider is configured, or a generic
 * Error when the provider fails or returns no usable content.
 */
export async function generateAssistantReply(input: GenerateAssistantReplyInput): Promise<string> {
  const message = String(input.message ?? '').trim()
  if (!message) throw new Error('A message is required')

  const client = getClient()
  const response = await client.messages.create({
    model: ASSISTANT_AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    temperature: 0.5,
    system: [{ type: 'text', text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: buildAssistantUserPrompt({ message: message.slice(0, MAX_MESSAGE_LENGTH), context: input.context }),
      },
    ],
  })

  const text = extractText(response)
  if (!text) throw new Error('The assistant returned an empty response')
  return text
}
