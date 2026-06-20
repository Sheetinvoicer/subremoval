import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NewProjectPage from '@/app/dashboard/projects/new/page';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: any) => <a href={href} className={className}>{children}</a>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn().mockReturnValue(null),
}));

describe('New Project page', () => {
  it('shows validation error when project name is empty', async () => {
    render(<NewProjectPage />);

    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('Project name is required.')).toBeInTheDocument();
  });
});
