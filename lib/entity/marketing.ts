import type { AICaller, EntityAction } from './types'
import type { SafetyController } from './safety'

export type MarketingChannel = 'blog' | 'twitter' | 'linkedin' | 'instagram' | 'email'

export interface MarketingRequest {
  channel: MarketingChannel
  topic: string
  audience?: string
  tone?: string
}

const SYSTEM_PROMPT = `You are SheetInvoicer's marketing copywriter. SheetInvoicer is an
invoicing SaaS for freelancers and small businesses.

Write a single piece of copy for the requested channel. Be specific, helpful and
honest; no hype, no fake statistics. A human will REVIEW your draft before it is
ever published — you do not and cannot publish anything yourself.

Start with a short "Title:" line, then the body.`

/**
 * Marketing module. Generates content drafts and files each one as a
 * `medium`-permission proposal. Drafts are never published automatically;
 * actually posting to a third-party network is a separate `high` action that a
 * human must approve (and requires a real integration to be wired in).
 */
export class Marketing {
  constructor(
    private readonly ai: AICaller,
    private readonly safety: SafetyController,
  ) {}

  async generateDraft(request: MarketingRequest): Promise<EntityAction> {
    const audience = request.audience?.trim() || 'freelancers and small businesses'
    const tone = request.tone?.trim() || 'helpful and concise'
    const prompt = [
      `Channel: ${request.channel}`,
      `Topic: ${request.topic}`,
      `Audience: ${audience}`,
      `Tone: ${tone}`,
      '',
      `Write the ${request.channel} draft now.`,
    ].join('\n')

    const content = await this.ai({ system: SYSTEM_PROMPT, prompt, maxTokens: 1200 })

    return this.safety.propose({
      module: 'marketing',
      type: 'marketing.draft',
      title: `Marketing draft — ${request.channel}: ${request.topic}`,
      summary: 'AI-written content for your review. It will NOT be published until you approve it.',
      payload: {
        channel: request.channel,
        topic: request.topic,
        audience,
        tone,
        content,
      },
    })
  }
}
