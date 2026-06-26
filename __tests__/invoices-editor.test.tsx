import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Stable router so we can assert navigation (the global setup mock returns fresh
// jest.fns per call).
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}))

// Detection + autosave are exercised in their own suites; stub them here so the
// editor test focuses on validation, money and persistence.
jest.mock('@/hooks/useSmartDetection', () => ({
  useSmartDetection: () => ({
    currency: 'USD',
    taxRate: 0,
    taxType: 'Tax',
    detected: null,
    autoDetect: false,
    manualOverride: false,
    detecting: false,
    error: null,
    rates: null,
    setCurrency: jest.fn(),
    setTaxRate: jest.fn(),
    setAutoDetect: jest.fn(),
    redetect: jest.fn(),
  }),
}))

const mockClearDraft = jest.fn(async () => {})
jest.mock('@/hooks/useAutoSaveDraft', () => ({
  useAutoSaveDraft: () => ({
    status: 'idle',
    lastSavedAt: null,
    availableDraft: null,
    restore: jest.fn(async () => null),
    clear: mockClearDraft,
    dismiss: jest.fn(),
  }),
}))

jest.mock('@/lib/invoiceNumber', () => ({ generateInvoiceNumber: jest.fn(async () => 'INV-NEW') }))
jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
  captureException: jest.fn(),
}))
jest.mock('@/components/CSVUploader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/SmartCurrencyTax', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/LoadingSkeleton', () => ({ FormPageSkeleton: () => null }))

let mockClient: ReturnType<typeof makeSupabase>
jest.mock('@/lib/supabase/client', () => ({ createClient: () => mockClient }))

import InvoiceEditor from '@/components/invoices/InvoiceEditor'

function makeSupabase(invoiceRow?: Record<string, unknown>) {
  const state: { inserts: { table: string; payload: Record<string, unknown> }[]; updates: { table: string; payload: Record<string, unknown> }[] } = {
    inserts: [],
    updates: [],
  }

  const resolveList = (table: string) => {
    if (table === 'clients') return { data: [{ id: 'c1', name: 'ACME', email: 'a@a.com' }], error: null }
    if (table === 'projects') return { data: [{ id: 'p1', name: 'Proj' }], error: null }
    return { error: null }
  }
  const resolveSingle = (table: string, op: string) => {
    if (table === 'invoices' && op === 'insert') return { data: { id: 'new-inv-1' }, error: null }
    if (table === 'invoices' && op === 'select')
      return { data: invoiceRow ?? null, error: invoiceRow ? null : { message: 'not found' } }
    return { data: null, error: null }
  }

  const from = (table: string) => {
    let op = 'select'
    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: (payload: Record<string, unknown>) => {
        op = 'insert'
        state.inserts.push({ table, payload })
        return builder
      },
      update: (payload: Record<string, unknown>) => {
        op = 'update'
        state.updates.push({ table, payload })
        return builder
      },
      eq: () => builder,
      order: () => builder,
      single: async () => resolveSingle(table, op),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(resolveList(table)).then(resolve, reject),
    }
    return builder
  }

  return { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) }, from, __state: state }
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  mockClient = makeSupabase()
})

describe('InvoiceEditor — create', () => {
  it('blocks submit and shows an error when no client is selected', async () => {
    render(<InvoiceEditor mode="create" />)
    const submit = await screen.findByRole('button', { name: 'Create Invoice' })
    fireEvent.click(submit)
    expect(await screen.findByText('Please select a client.')).toBeInTheDocument()
    expect(mockClient.__state.inserts).toHaveLength(0)
  })

  it('inserts the computed roll-ups and navigates to the new invoice', async () => {
    render(<InvoiceEditor mode="create" />)
    await screen.findByRole('button', { name: 'Create Invoice' })

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c1' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Design' } })
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/invoices/new-inv-1'))
    const insert = mockClient.__state.inserts.find((i) => i.table === 'invoices')
    expect(insert?.payload).toMatchObject({
      subtotal: 100,
      tax_amount: 0,
      total: 100,
      client_name: 'ACME',
      status: 'draft',
    })
    expect((insert?.payload.items as Record<string, unknown>[])[0]).toMatchObject({
      description: 'Design',
      quantity: 1,
      price: 100,
      total: 100,
    })
    expect(mockClearDraft).toHaveBeenCalled()
  })

  it('applies a per-line tax rate to the live total', async () => {
    render(<InvoiceEditor mode="create" />)
    await screen.findByRole('button', { name: 'Create Invoice' })

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Dev' } })
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Tax %'), { target: { value: '20' } })

    expect(await screen.findByText(/USD 120\.00/)).toBeInTheDocument()
  })
})

describe('InvoiceEditor — edit', () => {
  const invoiceRow = {
    id: 'inv-9',
    invoice_number: 'INV-9',
    client_id: 'c1',
    project_id: 'p1',
    currency: 'EUR',
    tax_rate_percentage: 0,
    due_date: '2026-07-01',
    notes: 'hi',
    items: [{ description: 'X', quantity: 2, price: 50, taxRate: 10 }],
    metadata: {},
  }

  it('hydrates the form from the invoice and updates the recomputed roll-ups', async () => {
    mockClient = makeSupabase(invoiceRow)
    render(<InvoiceEditor mode="edit" invoiceId="inv-9" />)

    expect(await screen.findByDisplayValue('X')).toBeInTheDocument()
    expect(screen.getByText('Edit Invoice INV-9')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/invoices/inv-9'))
    const update = mockClient.__state.updates.find((u) => u.table === 'invoices')
    expect(update?.payload).toMatchObject({ subtotal: 100, tax_amount: 10, total: 110 })
  })
})
