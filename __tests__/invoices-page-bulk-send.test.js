import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import InvoicesPage from '@/app/dashboard/invoices/page'

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

const { createClient } = require('@/lib/supabase/client')

function makeSupabaseMock(invoices) {
  const query = {
    eq: jest.fn(() => query),
    order: jest.fn().mockResolvedValue({ data: invoices, error: null }),
  }

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => query),
    })),
  }
}

describe('InvoicesPage bulk sending', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('allows selecting invoices and shows progress while sending in bulk', async () => {
    createClient.mockReturnValue(
      makeSupabaseMock([
        {
          id: 'inv-1',
          invoice_number: '1001',
          total: 10,
          currency: 'USD',
          status: 'draft',
          due_date: '2026-06-20',
          created_at: '2026-06-01',
          clients: { name: 'Alice' },
        },
        {
          id: 'inv-2',
          invoice_number: '1002',
          total: 20,
          currency: 'USD',
          status: 'draft',
          due_date: '2026-06-20',
          created_at: '2026-06-02',
          clients: { name: 'Bob' },
        },
      ]),
    )

    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Bad email' }) })

    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText('Invoices')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    fireEvent.click(screen.getByRole('button', { name: /send selected \(2\)/i }))

    await waitFor(() => {
      expect(screen.getByText(/Progress: 2\/2 • Sent: 1 • Failed: 1/i)).toBeInTheDocument()
      expect(screen.getByText(/Selected invoices: 2/i)).toBeInTheDocument()
    })
  })
})
