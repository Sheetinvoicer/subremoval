import { Anthropic } from '@anthropic-ai/sdk'
import { callAI, AI_PROVIDERS } from '@/lib/ai/config'
import type { AICaller } from './types'

// Claude is the primary model (best for this planning/copy work); GPT-4o is the
// resilience fallback, mirroring lib/ai/config.js. Bound the latency of a single
// attempt so a stuck upstream request can't hang an API route.
const MODEL = 'claude-opus-4-6'
const TIMEOUT_MS = 60_000
const MAX_RETRIES = 1

/**
 * Default {@link AICaller}, backed by Claude through the official Anthropic SDK.
 *
 * The (stable) system prompt is sent as a cached block (`cache_control:
 * ephemeral`) so repeated calls reuse the prefix instead of re-billing it every
 * request — prompt caching is required by the Claude API skill. On any Claude
 * failure we fall back to GPT-4o via the shared `callAI` helper.
 */
export function createClaudeAICaller(): AICaller {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  })

  return async ({ system, prompt, maxTokens = 1024, temperature = 0.3 }) => {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      })

      let text = ''
      for (const block of response.content) {
        if (block.type === 'text') text += block.text
      }
      return text.trim()
    } catch (error) {
      console.error('Entity Claude call failed, falling back to GPT-4o:', error)
      // The fallback helper takes a single string, so fold the system
      // instructions into the prompt.
      return callAI(`${system}\n\n${prompt}`, AI_PROVIDERS.GPT4)
    }
  }
}
