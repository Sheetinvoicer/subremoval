import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

let insertMock: jest.Mock
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: () => ({ insert: insertMock }),
  }),
}))

import RecurringScheduleEditor from '@/components/recurring/RecurringScheduleEditor'

beforeEach(() => {
  jest.clearAllMocks()
  insertMock = jest.fn().mockResolvedValue({ error: null })
})

describe('RecurringScheduleEditor', () => {
  it('adds a skip date and persists it in the exceptions array on submit', async () => {
    render(<RecurringScheduleEditor />)

    fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } })

    fireEvent.change(screen.getByLabelText('Skip dates'), { target: { value: '2026-07-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add date' }))

    expect(screen.getByText('2026-07-01')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Recurring Invoice' }))

    await waitFor(() => expect(insertMock).toHaveBeenCalled())
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: 'Acme', amount: 100, exceptions: ['2026-07-01'] }),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/recurring'))
  })

  it('removes a skip date before submit', async () => {
    render(<RecurringScheduleEditor />)

    fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })

    fireEvent.change(screen.getByLabelText('Skip dates'), { target: { value: '2026-09-09' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add date' }))
    expect(screen.getByText('2026-09-09')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Remove date 2026-09-09/ }))
    expect(screen.queryByText('2026-09-09')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Recurring Invoice' }))
    await waitFor(() => expect(insertMock).toHaveBeenCalled())
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ exceptions: [] }))
  })

  it('prefills fields and skip dates when duplicating an existing schedule', () => {
    render(
      <RecurringScheduleEditor
        duplicate
        initialValue={{
          client_name: 'Globex',
          amount: 250,
          currency: 'EUR',
          frequency: 'weekly',
          next_date: '2026-08-01',
          status: 'active',
          notes: 'Retainer',
          exceptions: ['2026-08-15', '2026-08-08'],
        }}
      />,
    )

    expect(screen.getByText('Duplicate Recurring Invoice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Globex')).toBeInTheDocument()
    expect(screen.getByDisplayValue('250')).toBeInTheDocument()
    // Sorted, de-duplicated skip dates are shown as chips.
    expect(screen.getByText('2026-08-08')).toBeInTheDocument()
    expect(screen.getByText('2026-08-15')).toBeInTheDocument()
  })
})
