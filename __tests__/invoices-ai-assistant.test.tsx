import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AILineItemAssistant from '@/components/invoices/AILineItemAssistant'

jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
  captureException: jest.fn(),
}))

describe('AILineItemAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn() as jest.Mock
  })

  it('disables Generate until a brief is entered', () => {
    render(<AILineItemAssistant currency="USD" locale="en" onApply={jest.fn()} />)
    expect(screen.getByRole('button', { name: /Generate/i })).toBeDisabled()
  })

  it('generates items and applies them (with notes) to the invoice', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ description: 'Logo design', quantity: 1, price: 500 }],
        notes: 'Net 30',
      }),
    })
    const onApply = jest.fn()
    render(<AILineItemAssistant currency="USD" locale="en" onApply={onApply} />)

    fireEvent.change(screen.getByLabelText('Describe the work'), { target: { value: 'Design a logo' } })
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))

    await screen.findByText('Logo design')
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/invoices/ai-generate')
    expect(JSON.parse(init.body)).toMatchObject({ brief: 'Design a logo', currency: 'USD', locale: 'en' })

    fireEvent.click(screen.getByRole('button', { name: /Add to invoice/i }))
    expect(onApply).toHaveBeenCalledWith({
      items: [{ description: 'Logo design', quantity: 1, price: 500 }],
      notes: 'Net 30',
    })
  })

  it('shows an upgrade prompt when the plan is locked (403)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: 'feature_locked' }),
    })
    const onApply = jest.fn()
    render(<AILineItemAssistant currency="USD" locale="en" onApply={onApply} />)

    fireEvent.change(screen.getByLabelText('Describe the work'), { target: { value: 'something' } })
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))

    await screen.findByText('AI generation is available on the Pro plan and above.')
    expect(onApply).not.toHaveBeenCalled()
  })
})
