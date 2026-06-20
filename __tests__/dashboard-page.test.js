import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/i18n', () => ({
  t: () => null,
}));

jest.mock('recharts', () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    AreaChart: Mock,
    Area: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    ResponsiveContainer: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
    Legend: Mock,
  };
});

const createSupabaseMock = ({ userId = 'user-1', invoices = [], clients = [], expenses = [], authError = null, queryError = null } = {}) => {
  const from = jest.fn((table) => {
    if (table === 'invoices') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn((column, value) => {
            if (column !== 'user_id' || value !== userId) {
              return { order: jest.fn().mockResolvedValue({ data: [], error: new Error('wrong-filter') }) };
            }
            return {
              order: jest.fn().mockResolvedValue({ data: invoices, error: queryError }),
            };
          }),
        })),
      };
    }

    if (table === 'clients') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: clients, error: null }),
        })),
      };
    }

    return {
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: expenses, error: null }),
      })),
    };
  });

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: authError,
      }),
    },
    from,
  };
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@/lib/supabase/client');

describe('DashboardPage', () => {
  it('loads invoices for the logged-in user', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        userId: 'user-123',
        invoices: [
          { id: '1', status: 'paid', total: 100, created_at: new Date().toISOString() },
        ],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Invoices')).toBeInTheDocument();
      expect(screen.queryByText('Error:')).not.toBeInTheDocument();
    });
  });

  it('shows query error instead of empty-state when invoices query fails', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        userId: 'user-123',
        queryError: { message: 'invoice query failed' },
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/invoice query failed/i)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });
});
