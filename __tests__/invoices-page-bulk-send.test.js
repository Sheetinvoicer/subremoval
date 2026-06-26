import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BulkActionBar from '@/components/invoices/BulkActionBar'

// Send reuses POST /api/send-invoice (fetch); the other bulk actions go through
// the browser Supabase client, which is mocked here even though send never calls it.
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

function makeRow(id, invoiceNumber) {
  return {
    id,
    invoice_number: invoiceNumber,
    total: 10,
    currency: 'USD',
    status: 'draft',
    due_date: '2026-06-20',
    created_at: '2026-06-01',
    updated_at: null,
    client_id: null,
    project_id: null,
    client_name: 'Alice',
    project_name: null,
    tags: null,
  }
}

describe('BulkActionBar bulk sending', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('sends every selected invoice and reports per-item success/failure', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Bad email' }) })

    const onDone = jest.fn()

    render(
      <BulkActionBar
        selectedIds={['inv-1', 'inv-2']}
        invoices={[makeRow('inv-1', '1001'), makeRow('inv-2', '1002')]}
        onChangeSelection={jest.fn()}
        onDone={onDone}
      />,
    )

    // Selection summary with the live count.
    expect(screen.getByText('2 selected')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    // One POST per selected invoice.
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/send-invoice',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ invoiceId: 'inv-1' }) }),
    )

    // Per-item results: one success, one failure surfacing the API error.
    await waitFor(() => {
      expect(screen.getByText(/1001: Done/i)).toBeInTheDocument()
      expect(screen.getByText(/1002: Failed/i)).toBeInTheDocument()
      expect(screen.getByText(/Bad email/i)).toBeInTheDocument()
    })

    // Progress reached completion and the list was asked to refetch.
    expect(screen.getByText(/Processing 2\/2/i)).toBeInTheDocument()
    expect(onDone).toHaveBeenCalled()
  })

  it('disables the bulk actions when nothing is selected', () => {
    render(
      <BulkActionBar
        selectedIds={[]}
        invoices={[makeRow('inv-1', '1001')]}
        onChangeSelection={jest.fn()}
        onDone={jest.fn()}
      />,
    )

    expect(screen.getByText('Select invoices to act on them')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })
})
