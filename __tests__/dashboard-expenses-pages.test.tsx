import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExpensesPage from '@/app/dashboard/expenses/page';
import NewExpensePage from '@/app/dashboard/expenses/new/page';

const push = jest.fn();

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    back: jest.fn(),
  }),
  useParams: () => ({ id: 'expense-1' }),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@/lib/supabase/client');

describe('Dashboard Expenses pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters expenses list by logged-in user id', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from,
    });

    render(<ExpensesPage />);

    await waitFor(() => {
      expect(eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(order).toHaveBeenCalledWith('date', { ascending: false });
    });
  });

  it('validates amount before creating an expense', async () => {
    const insert = jest.fn();
    const from = jest.fn().mockReturnValue({ insert });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from,
    });

    render(<NewExpensePage />);

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Expense' }));

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than 0.')).toBeInTheDocument();
      expect(insert).not.toHaveBeenCalled();
    });
  });

  it('creates an expense and routes to detail page', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'expense-99' }, error: null });
    const selectAfterInsert = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select: selectAfterInsert });
    const from = jest.fn().mockReturnValue({ insert });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from,
    });

    render(<NewExpensePage />);

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '42.50' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'usd' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Expense' }));

    await waitFor(() => {
      expect(insert).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith('/dashboard/expenses/expense-99');
    });
  });
});