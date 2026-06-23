import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';

// Hard limits applied to every provider call so a stuck upstream request can't
// hang an API route indefinitely. `timeout` caps a single attempt and the low
// `maxRetries` keeps worst-case latency bounded, letting the GPT-4 fallback
// kick in quickly instead of retrying a slow request many times.
const AI_TIMEOUT_MS = 60_000;
const AI_MAX_RETRIES = 1;

// Claude (Primary - Best for code quality)
const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: AI_TIMEOUT_MS,
  maxRetries: AI_MAX_RETRIES,
});

// GPT-4 (Fallback / Secondary)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: AI_TIMEOUT_MS,
  maxRetries: AI_MAX_RETRIES,
});

// Small in-memory cache so repeated identical prompts return instantly instead
// of re-hitting the model. Provider-neutral: the same prompt to the same
// provider yields the same answer, so it is safe to memoize for a short window.
const AI_CACHE_TTL_MS = 5 * 60_000;
const AI_CACHE_MAX_ENTRIES = 200;
const responseCache = new Map();

function readCache(key) {
  const hit = responseCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(key);
    return undefined;
  }
  // Refresh recency so the entry survives LRU-style eviction.
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit.value;
}

function writeCache(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + AI_CACHE_TTL_MS });
  if (responseCache.size > AI_CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
}

export const AI_PROVIDERS = {
  CLAUDE: 'claude',
  GPT4: 'gpt4',
};

export const AI_CONFIG = {
  primary: AI_PROVIDERS.CLAUDE,
  models: {
    [AI_PROVIDERS.CLAUDE]: {
      model: 'claude-3-opus-20240229',
      maxTokens: 4096,
      temperature: 0.3,
    },
    [AI_PROVIDERS.GPT4]: {
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.3,
    },
  },
};

export async function callAI(prompt, provider = AI_PROVIDERS.CLAUDE) {
  const cacheKey = `${provider}::${prompt}`;
  const cached = readCache(cacheKey);
  if (cached !== undefined) return cached;

  try {
    let result;
    if (provider === AI_PROVIDERS.CLAUDE) {
      const response = await claude.messages.create({
        model: AI_CONFIG.models[provider].model,
        max_tokens: AI_CONFIG.models[provider].maxTokens,
        temperature: AI_CONFIG.models[provider].temperature,
        messages: [{ role: 'user', content: prompt }],
      });
      result = response.content[0].text;
    } else {
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.models[provider].model,
        max_tokens: AI_CONFIG.models[provider].maxTokens,
        temperature: AI_CONFIG.models[provider].temperature,
        messages: [{ role: 'user', content: prompt }],
      });
      result = response.choices[0].message.content;
    }
    writeCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('AI Error:', error);
    // Fallback to secondary provider
    if (provider === AI_PROVIDERS.CLAUDE) {
      return callAI(prompt, AI_PROVIDERS.GPT4);
    }
    throw error;
  }
}

export default callAI;
