import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ShareLinkPanel from '@/components/invoices/ShareLinkPanel'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

import { createClient } from '@/lib/supabase/client'
const mockCreateClient = createClient as jest.Mock

function mockAuthedClient() {
  mockCreateClient.mockReturnValue({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok-123' } } }),
    },
  })
}

const activeLink = {
  id: 'link-1',
  token: 'abc123',
  expires_at: null,
  revoked_at: null,
  view_count: 5,
  last_viewed_at: null,
  created_at: '2026-06-01T00:00:00Z',
}

describe('ShareLinkPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    mockAuthedClient()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('shows an empty state and create form when there is no link', () => {
    render(<ShareLinkPanel invoiceId="inv-1" link={null} />)
    expect(screen.getByText('No share link yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create link' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Public share link' })).toBeInTheDocument()
  })

  it('creates a share link and reports success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ link: activeLink }) })
    const onChanged = jest.fn()

    render(<ShareLinkPanel invoiceId="inv-1" link={null} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/invoices/share')
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
    )
    expect(JSON.parse(init.body)).toMatchObject({ invoiceId: 'inv-1' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('renders an active link with its public URL and view count', async () => {
    render(<ShareLinkPanel invoiceId="inv-1" link={activeLink} />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    // The public URL is built from window.location.origin once mounted.
    const input = screen.getByLabelText('Public link') as HTMLInputElement
    await waitFor(() => expect(input.value).toContain('/invoice/abc123'))
  })

  it('copies the public URL to the clipboard', async () => {
    render(<ShareLinkPanel invoiceId="inv-1" link={activeLink} />)
    const input = screen.getByLabelText('Public link') as HTMLInputElement
    await waitFor(() => expect(input.value).toContain('/invoice/abc123'))

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/invoice/abc123')),
    )
  })

  it('revokes the active link via the API', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    const onChanged = jest.fn()

    render(<ShareLinkPanel invoiceId="inv-1" link={activeLink} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/invoices/share?id=link-1')
    expect(init).toEqual(expect.objectContaining({ method: 'DELETE' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('treats a revoked link as inactive and offers to create a new one', () => {
    render(
      <ShareLinkPanel
        invoiceId="inv-1"
        link={{ ...activeLink, revoked_at: '2026-06-02T00:00:00Z' }}
      />,
    )
    expect(screen.getByText('Revoked')).toBeInTheDocument()
    // No revoke button for an already-inactive link.
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })
})
