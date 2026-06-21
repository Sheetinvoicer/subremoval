import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: replaceMock,
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
  beforeEach(() => {
    replaceMock.mockClear();
  });

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

  it('redirects to login when auth session is missing', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        userId: null,
        authError: { message: 'Auth session missing!' },
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText(/auth session missing/i)).not.toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', async () => {
    createClient.mockReturnValue(createSupabaseMock({ userId: null, authError: null }));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('shows auth error when failure is not unauthenticated state', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        userId: null,
        authError: { message: 'Network unavailable' },
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/network unavailable/i)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
    expect(replaceMock).not.toHaveBeenCalledWith('/login');
  });
});
