import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/dashboard/settings/page';

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@/lib/supabase/client');

describe('Dashboard Settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'cookie_consent=rejected',
    });
    global.fetch = jest.fn();
    window.localStorage.clear();
    window.confirm = jest.fn(() => true);
  });

  it('loads settings for the authenticated user', async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        default_currency: 'EUR',
        language: 'fr',
        theme: 'dark',
        notifications_enabled: false,
        company_name: 'Acme Corp',
        company_email: 'hello@acme.com',
        company_phone: '+12025550123',
        company_address: 'Paris',
      },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from,
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(screen.getByDisplayValue('EUR')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Français')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dark')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
    });
  });

  it('saves settings for the authenticated user', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
      upsert,
    });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from,
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Company Name'), { target: { value: 'New Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          company_name: 'New Co',
          default_currency: 'USD',
          language: 'en',
          theme: 'system',
          notifications_enabled: true,
        }),
        expect.objectContaining({ onConflict: 'user_id' })
      );
    });
  });

  it('exports personal data using GDPR endpoint', async () => {
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token-abc' } } }),
      },
      from,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ user: { id: 'user-123' }, data: {} }),
    });

    const createObjectURLMock = jest.fn(() => 'blob:url');
    const revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export my data (JSON)' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export my data (JSON)' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/gdpr/export', expect.objectContaining({ method: 'GET' }));
      expect(screen.getByText('Your data export is ready and has been downloaded.')).toBeInTheDocument();
    });
  });

  it('saves accounting mapping and triggers QuickBooks export', async () => {
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token-abc' } } }),
      },
      from,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(new Blob(['sample']))
    });

    const createObjectURLMock = jest.fn(() => 'blob:url-accounting');
    const revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save mapping' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Sales'), { target: { value: 'Revenue-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save mapping' }));

    expect(window.localStorage.getItem('sheetinvoicer_accounting_mapping')).toContain('Revenue-001');

    fireEvent.click(screen.getByRole('button', { name: 'Export QuickBooks (CSV)' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/export', expect.objectContaining({
        method: 'POST',
      }));
      expect(screen.getByText('QUICKBOOKS export is ready and has been downloaded.')).toBeInTheDocument();
    });
  });

  it('starts the Stripe Connect OAuth flow when connecting a bank account', async () => {
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token-abc' } } }),
      },
      from,
    });

    // jsdom cannot perform (or assert on) a real navigation, so we only verify
    // that the handler called the OAuth start endpoint and entered the in-flight
    // state; the subsequent window.location handoff is a browser concern.
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/oauth' }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Connect Bank Account' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Connect Bank Account' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/stripe/connect', expect.objectContaining({
        method: 'POST',
      }));
      // The handler switches to the in-flight label while the browser hands off
      // to Stripe, confirming the success path ran without an error.
      expect(screen.getByRole('button', { name: 'Connecting...' })).toBeInTheDocument();
    });
  });

  it('surfaces an error when bank connection is not configured', async () => {
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token-abc' } } }),
      },
      from,
    });

    global.fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: 'Stripe Connect is not configured. Set STRIPE_CONNECT_CLIENT_ID to enable bank connection.',
      }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Connect Bank Account' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Connect Bank Account' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/stripe/connect', expect.objectContaining({
        method: 'POST',
      }));
      expect(
        screen.getByText('Stripe Connect is not configured. Set STRIPE_CONNECT_CLIENT_ID to enable bank connection.'),
      ).toBeInTheDocument();
    });
  });
});
