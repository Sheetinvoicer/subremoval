import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BulkActionBar from '@/components/invoices/BulkActionBar'
import type { InvoiceListRow } from '@/hooks/useInvoicesQuery'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

import { createClient } from '@/lib/supabase/client'
const mockCreateClient = createClient as jest.Mock

function makeRow(id: string, invoiceNumber: string): InvoiceListRow {
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

interface MockOptions {
  subtotals?: Record<string, number>
  updateError?: { message: string } | null
  deleteError?: { message: string } | null
  selectError?: { message: string } | null
}

/** Builds a chainable Supabase mock whose write/select builders capture calls. */
function makeSupabase(options: MockOptions = {}) {
  const { subtotals = {}, updateError = null, deleteError = null, selectError = null } = options
  const rows = Object.entries(subtotals).map(([id, subtotal]) => ({ id, subtotal }))

  const update = jest.fn(() => {
    const p: any = Promise.resolve({ error: updateError })
    p.eq = () => p
    return p
  })
  const del = jest.fn(() => {
    const p: any = Promise.resolve({ error: deleteError })
    p.eq = () => p
    return p
  })
  const select = jest.fn(() => {
    const p: any = Promise.resolve({ data: rows, error: selectError })
    p.in = () => p
    p.eq = () => p
    return p
  })

  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: jest.fn(() => ({ update, delete: del, select })),
    __update: update,
    __delete: del,
    __select: select,
  }
}

const TWO = ['inv-1', 'inv-2']
const TWO_ROWS = [makeRow('inv-1', '1001'), makeRow('inv-2', '1002')]

describe('BulkActionBar actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('marks every selected invoice as paid and refetches', async () => {
    const client = makeSupabase()
    mockCreateClient.mockReturnValue(client)
    const onDone = jest.fn()

    render(
      <BulkActionBar selectedIds={TWO} invoices={TWO_ROWS} onChangeSelection={jest.fn()} onDone={onDone} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark as paid' }))

    await waitFor(() => expect(client.__update).toHaveBeenCalledTimes(2))
    expect(client.__update).toHaveBeenCalledWith({ status: 'paid' })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(screen.getByText(/1001: Done/i)).toBeInTheDocument()
    expect(screen.getByText(/1002: Done/i)).toBeInTheDocument()
  })

  it('applies a tax rate, recomputing tax_amount/total from the persisted subtotal', async () => {
    const client = makeSupabase({ subtotals: { 'inv-1': 100, 'inv-2': 50 } })
    mockCreateClient.mockReturnValue(client)

    render(
      <BulkActionBar selectedIds={TWO} invoices={TWO_ROWS} onChangeSelection={jest.fn()} onDone={jest.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply tax rate' }))
    fireEvent.change(screen.getByLabelText('Tax rate (%)'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    // Subtotals are fetched once, then one update per invoice.
    await waitFor(() => expect(client.__select).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(client.__update).toHaveBeenCalledTimes(2))
    expect(client.__update).toHaveBeenCalledWith({ tax_rate_percentage: 20, tax_amount: 20, total: 120 })
    expect(client.__update).toHaveBeenCalledWith({ tax_rate_percentage: 20, tax_amount: 10, total: 60 })
  })

  it('rounds the recomputed tax to 2 decimals', async () => {
    const client = makeSupabase({ subtotals: { 'inv-1': 33.33 } })
    mockCreateClient.mockReturnValue(client)

    render(
      <BulkActionBar
        selectedIds={['inv-1']}
        invoices={[makeRow('inv-1', '1001')]}
        onChangeSelection={jest.fn()}
        onDone={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply tax rate' }))
    fireEvent.change(screen.getByLabelText('Tax rate (%)'), { target: { value: '7.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    // 33.33 * 7.5 / 100 = 2.49975 -> 2.5 ; total 33.33 + 2.5 = 35.83
    await waitFor(() =>
      expect(client.__update).toHaveBeenCalledWith({ tax_rate_percentage: 7.5, tax_amount: 2.5, total: 35.83 }),
    )
  })

  it('rejects an out-of-range tax rate without touching the database', async () => {
    const client = makeSupabase({ subtotals: { 'inv-1': 100 } })
    mockCreateClient.mockReturnValue(client)

    render(
      <BulkActionBar
        selectedIds={['inv-1']}
        invoices={[makeRow('inv-1', '1001')]}
        onChangeSelection={jest.fn()}
        onDone={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply tax rate' }))
    fireEvent.change(screen.getByLabelText('Tax rate (%)'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(client.__update).not.toHaveBeenCalled())
  })

  it('deletes selected invoices only after confirmation, then clears the selection', async () => {
    const client = makeSupabase()
    mockCreateClient.mockReturnValue(client)
    const onChangeSelection = jest.fn()
    const onDone = jest.fn()

    render(
      <BulkActionBar
        selectedIds={TWO}
        invoices={TWO_ROWS}
        onChangeSelection={onChangeSelection}
        onDone={onDone}
      />,
    )

    // First click only opens the confirmation — no delete yet.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete 2 invoices?')).toBeInTheDocument()
    expect(client.__delete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(client.__delete).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onChangeSelection).toHaveBeenCalledWith([]))
    expect(onDone).toHaveBeenCalled()
  })

  it('reports a per-item failure when a delete is rejected', async () => {
    const client = makeSupabase({ deleteError: { message: 'RLS denied' } })
    mockCreateClient.mockReturnValue(client)
    const onChangeSelection = jest.fn()

    render(
      <BulkActionBar
        selectedIds={['inv-1']}
        invoices={[makeRow('inv-1', '1001')]}
        onChangeSelection={onChangeSelection}
        onDone={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(screen.getByText(/1001: Failed/i)).toBeInTheDocument())
    expect(screen.getByText(/RLS denied/i)).toBeInTheDocument()
    // A failed run keeps the selection (nothing was actually removed).
    expect(onChangeSelection).not.toHaveBeenCalledWith([])
  })
})
