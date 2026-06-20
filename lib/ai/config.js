import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';

// Claude (Primary - Best for code quality)
const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// GPT-4 (Fallback / Secondary)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      model: 'gpt-4-turbo-preview',
      maxTokens: 4096,
      temperature: 0.3,
    },
  },
};

export async function callAI(prompt, provider = AI_PROVIDERS.CLAUDE) {
  try {
    if (provider === AI_PROVIDERS.CLAUDE) {
      const response = await claude.messages.create({
        model: AI_CONFIG.models[provider].model,
        max_tokens: AI_CONFIG.models[provider].maxTokens,
        temperature: AI_CONFIG.models[provider].temperature,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text;
    } else {
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.models[provider].model,
        max_tokens: AI_CONFIG.models[provider].maxTokens,
        temperature: AI_CONFIG.models[provider].temperature,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.choices[0].message.content;
    }
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
