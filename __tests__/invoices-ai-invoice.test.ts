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
  AI_INVOICE_MODEL,
  buildInvoiceUserPrompt,
  generateInvoiceContent,
  InvoiceAiUnavailableError,
  parseGeneratedInvoiceContent,
} from '@/lib/ai/invoice'

describe('parseGeneratedInvoiceContent', () => {
  it('parses a clean JSON object', () => {
    const out = parseGeneratedInvoiceContent('{"items":[{"description":"Design","quantity":2,"price":150}],"notes":"Thanks"}')
    expect(out.items).toEqual([{ description: 'Design', quantity: 2, price: 150 }])
    expect(out.notes).toBe('Thanks')
  })

  it('tolerates code fences and surrounding prose', () => {
    const text = 'Here you go:\n```json\n{"items":[{"description":"Dev","quantity":1,"price":80}],"notes":""}\n```'
    const out = parseGeneratedInvoiceContent(text)
    expect(out.items).toHaveLength(1)
    expect(out.notes).toBe('')
  })

  it('drops invalid items and defaults notes', () => {
    const out = parseGeneratedInvoiceContent(
      '{"items":[{"description":"","quantity":1,"price":5},{"description":"OK","quantity":3,"price":0}]}',
    )
    expect(out.items).toEqual([{ description: 'OK', quantity: 3, price: 0 }])
    expect(out.notes).toBe('')
  })

  it('throws when there is no JSON', () => {
    expect(() => parseGeneratedInvoiceContent('no json here')).toThrow()
  })

  it('throws when there are no usable items', () => {
    expect(() => parseGeneratedInvoiceContent('{"items":[],"notes":"x"}')).toThrow()
  })
})

describe('buildInvoiceUserPrompt', () => {
  it('includes the currency, locale and brief but never the cached instructions', () => {
    const prompt = buildInvoiceUserPrompt({ brief: 'Logo redesign', currency: 'EUR', locale: 'de' })
    expect(prompt).toContain('EUR')
    expect(prompt).toContain('de')
    expect(prompt).toContain('Logo redesign')
  })
})

describe('generateInvoiceContent', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
    createMock.mockReset()
  })

  it('calls Claude with a cached system prefix and parses the response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{"items":[{"description":"A","quantity":1,"price":10}],"notes":"n"}' }],
    })

    const out = await generateInvoiceContent({ brief: 'Do work', currency: 'USD', locale: 'en' })
    expect(out.items[0]).toEqual({ description: 'A', quantity: 1, price: 10 })

    const arg = createMock.mock.calls[0][0]
    expect(arg.model).toBe(AI_INVOICE_MODEL)
    expect(Array.isArray(arg.system)).toBe(true)
    expect(arg.system[0].cache_control).toEqual({ type: 'ephemeral' })
    // The volatile brief must live in the user turn, not the cached system block.
    expect(arg.system[0].text).not.toContain('Do work')
    expect(arg.messages[0].content).toContain('Do work')
  })

  it('throws InvoiceAiUnavailableError when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(generateInvoiceContent({ brief: 'Do work' })).rejects.toBeInstanceOf(InvoiceAiUnavailableError)
  })
})
