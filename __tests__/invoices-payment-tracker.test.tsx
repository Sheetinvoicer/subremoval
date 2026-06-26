import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PaymentTracker from '@/components/invoices/PaymentTracker'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

import { createClient } from '@/lib/supabase/client'
const mockCreateClient = createClient as jest.Mock

function mockAuthedClient() {
  mockCreateClient.mockReturnValue({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok-123' } } }),
    },
  })
}

describe('PaymentTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    mockAuthedClient()
  })

  it('shows the total, amount paid and running balance from the payments prop', () => {
    render(
      <PaymentTracker
        invoiceId="inv-1"
        total={100}
        currency="USD"
        status="sent"
        payments={[{ id: 'p1', amount: 40 }]}
      />,
    )

    // total $100.00, paid $40.00, balance $60.00 (computed locally via computeBalance).
    // ($40.00 also appears in the recorded-payments list, hence getAllByText.)
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getAllByText('$40.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('$60.00')).toBeInTheDocument()
  })

  it('flags a fully paid invoice', () => {
    render(
      <PaymentTracker
        invoiceId="inv-1"
        total={100}
        currency="USD"
        status="paid"
        payments={[{ id: 'p1', amount: 100 }]}
      />,
    )
    expect(screen.getByText('This invoice is fully paid.')).toBeInTheDocument()
  })

  it('records a payment and reports the auto-paid transition', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ paid: 100, balance: 0, fullyPaid: true, status: 'paid' }),
    })
    const onRecorded = jest.fn()

    render(
      <PaymentTracker
        invoiceId="inv-1"
        total={100}
        currency="USD"
        status="sent"
        payments={[]}
        onRecorded={onRecorded}
      />,
    )

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/invoices/payments')
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
    )
    expect(JSON.parse(init.body)).toMatchObject({ invoiceId: 'inv-1', amount: 100, kind: 'payment' })

    await waitFor(() =>
      expect(onRecorded).toHaveBeenCalledWith({ fullyPaid: true, status: 'paid', balance: 0 }),
    )
  })

  it('rejects a zero amount without calling the API', async () => {
    render(
      <PaymentTracker invoiceId="inv-1" total={100} currency="USD" status="sent" payments={[]} />,
    )

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))

    await Promise.resolve()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows an accessible empty state when there are no payments', () => {
    render(
      <PaymentTracker invoiceId="inv-1" total={100} currency="USD" status="sent" payments={[]} />,
    )
    expect(screen.getByText('No payments recorded yet.')).toBeInTheDocument()
    // The balance region is an ARIA live region so updates are announced.
    expect(screen.getByRole('region', { name: 'Payments' })).toBeInTheDocument()
  })
})
