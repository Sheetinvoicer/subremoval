// Mock the SDK so the real network client is never constructed; capture the
// create() args so we can assert the cached-prefix wiring.
const createMock = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create: (...args: unknown[]) => createMock(...args) }
  },
}))

import {
  ASSISTANT_AI_MODEL,
  ASSISTANT_SYSTEM_PROMPT,
  buildAssistantUserPrompt,
  generateAssistantReply,
  AssistantAiUnavailableError,
} from '@/lib/ai/assistant'

describe('buildAssistantUserPrompt', () => {
  it('embeds the question and grounds it in the metrics snapshot', () => {
    const prompt = buildAssistantUserPrompt({
      message: 'What should I focus on?',
      context: { currency: 'EUR', overdueAmount: 1200, overdueCount: 3 },
    })
    expect(prompt).toContain('What should I focus on?')
    expect(prompt).toContain('EUR')
    expect(prompt).toContain('1,200')
    // The volatile turn must never carry the cached system instructions.
    expect(prompt).not.toContain(ASSISTANT_SYSTEM_PROMPT)
  })

  it('notes when no snapshot is available', () => {
    const prompt = buildAssistantUserPrompt({ message: 'Hi' })
    expect(prompt).toContain('No metrics snapshot')
    expect(prompt).toContain('Hi')
  })
})

describe('generateAssistantReply', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
    createMock.mockReset()
  })

  it('calls Claude with a cached system prefix and returns the text', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Chase your 3 overdue invoices first.' }],
    })

    const reply = await generateAssistantReply({
      message: 'What should I do?',
      context: { overdueCount: 3 },
    })
    expect(reply).toBe('Chase your 3 overdue invoices first.')

    const arg = createMock.mock.calls[0][0]
    expect(arg.model).toBe(ASSISTANT_AI_MODEL)
    expect(Array.isArray(arg.system)).toBe(true)
    expect(arg.system[0].cache_control).toEqual({ type: 'ephemeral' })
    // The volatile question lives in the user turn, not the cached system block.
    expect(arg.system[0].text).not.toContain('What should I do?')
    expect(arg.messages[0].content).toContain('What should I do?')
  })

  it('throws AssistantAiUnavailableError when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(generateAssistantReply({ message: 'Hi' })).rejects.toBeInstanceOf(AssistantAiUnavailableError)
  })

  it('rejects an empty message', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    await expect(generateAssistantReply({ message: '   ' })).rejects.toThrow()
  })
})
