import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RecurringPage from '@/app/dashboard/recurring/page';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/i18n', () => ({
  t: (_key: string) => null,
}));

const { createClient } = require('@/lib/supabase/client');

describe('Recurring dashboard page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('toggles template status from active to paused', async () => {
    const eqUpdate = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq: eqUpdate });
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'rec-1',
          invoice_number: 'INV-R-1',
          client_name: 'Acme Corp',
          amount: 150,
          currency: 'USD',
          frequency: 'monthly',
          next_date: '2026-06-21',
          status: 'active',
          created_at: '2026-06-01',
        },
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ order });

    createClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'recurring_invoices') {
          return { select, update };
        }

        return {};
      }),
    });

    render(<RecurringPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-R-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ status: 'paused' });
      expect(eqUpdate).toHaveBeenCalledWith('id', 'rec-1');
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
  });
});
