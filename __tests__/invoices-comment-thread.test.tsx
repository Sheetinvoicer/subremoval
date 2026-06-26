import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CommentThread from '@/components/invoices/CommentThread'

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

describe('CommentThread', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    mockAuthedClient()
  })

  it('shows an accessible empty state when there are no comments', () => {
    render(<CommentThread invoiceId="inv-1" comments={[]} />)
    expect(screen.getByText('No comments yet.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Comments' })).toBeInTheDocument()
  })

  it('renders a parent comment and its nested reply', () => {
    render(
      <CommentThread
        invoiceId="inv-1"
        comments={[
          { id: 'c1', parent_id: null, audience: 'team', body: 'Parent note', created_at: '2026-06-01T10:00:00Z' },
          { id: 'c2', parent_id: 'c1', audience: 'team', body: 'A nested reply', created_at: '2026-06-01T11:00:00Z' },
        ]}
      />,
    )
    expect(screen.getByText('Parent note')).toBeInTheDocument()
    expect(screen.getByText('A nested reply')).toBeInTheDocument()
  })

  it('adds a comment with the chosen audience and reports success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ comment: { id: 'c9' } }) })
    const onChanged = jest.fn()

    render(<CommentThread invoiceId="inv-1" comments={[]} onChanged={onChanged} />)

    fireEvent.change(screen.getByLabelText('Add an internal note…'), { target: { value: 'Looks good' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/invoices/comments')
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
    )
    expect(JSON.parse(init.body)).toMatchObject({
      invoiceId: 'inv-1',
      body: 'Looks good',
      audience: 'team',
      parentId: null,
    })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('does not call the API for an empty comment', async () => {
    render(<CommentThread invoiceId="inv-1" comments={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))
    await Promise.resolve()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('deletes a comment via the API', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    const onChanged = jest.fn()

    render(
      <CommentThread
        invoiceId="inv-1"
        comments={[{ id: 'c1', parent_id: null, audience: 'team', body: 'Delete me', created_at: '2026-06-01T10:00:00Z' }]}
        onChanged={onChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/invoices/comments?id=c1')
    expect(init).toEqual(expect.objectContaining({ method: 'DELETE' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})
