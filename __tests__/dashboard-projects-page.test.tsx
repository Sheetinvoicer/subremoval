import React from 'react';
import { render, waitFor } from '@testing-library/react';
import ProjectsPage from '@/app/dashboard/projects/page';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: any) => <a href={href} className={className}>{children}</a>,
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@/lib/supabase/client');

describe('Dashboard Projects page', () => {
  it('filters projects by logged-in user id', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eqUser = jest.fn().mockReturnValue({ order, eq: jest.fn().mockReturnValue({ order }) });
    const select = jest.fn().mockReturnValue({ eq: eqUser });
    const from = jest.fn().mockReturnValue({ select });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from,
    });

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(eqUser).toHaveBeenCalledWith('user_id', 'user-123');
      expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });
});
