import { renderHook, act, waitFor } from '@testing-library/react'

const mockCreateClient = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => mockCreateClient() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

import { useAutoSaveDraft } from '@/hooks/useAutoSaveDraft'

const fetchMock = jest.fn()
// @ts-expect-error - assigning a jest mock to the global fetch in jsdom
global.fetch = fetchMock

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  mockCreateClient.mockReturnValue({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok-123' } } }),
    },
  })
})

describe('useAutoSaveDraft', () => {
  it('auto-saves user edits to localStorage and the server after debounce', async () => {
    fetchMock.mockImplementation(async (_url: string, opts: { method?: string } = {}) => {
      const method = opts.method || 'GET'
      if (method === 'GET') return jsonResponse({ latest: null, versions: [] })
      return jsonResponse({ draft: { version: 1 } })
    })

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSaveDraft({ draftKey: 'new', data, debounceMs: 10 }),
      { initialProps: { data: { client: '' } as Record<string, string> } },
    )

    // Initial (loaded) state is primed, not saved.
    rerender({ data: { client: 'c1' } })

    await waitFor(() => expect(result.current.status).toBe('saved'))

    const postCall = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')
    expect(postCall).toBeTruthy()
    expect(postCall[0]).toBe('/api/invoices/drafts')
    expect(JSON.parse(postCall[1].body)).toMatchObject({ invoiceId: 'new', payload: { client: 'c1' } })
    expect(postCall[1].headers.Authorization).toBe('Bearer tok-123')

    const stored = window.localStorage.getItem('invoice_draft:new')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored as string).payload).toMatchObject({ client: 'c1' })
  })

  it('surfaces a server draft for restore on mount', async () => {
    fetchMock.mockImplementation(async (_url: string, opts: { method?: string } = {}) => {
      const method = opts.method || 'GET'
      if (method === 'GET') {
        return jsonResponse({
          latest: { payload: { client: 'c1', notes: 'hi' }, created_at: '2026-06-25T10:00:00.000Z' },
          versions: [],
        })
      }
      return jsonResponse({})
    })

    const { result } = renderHook(() =>
      useAutoSaveDraft({ draftKey: 'inv-9', data: { client: '' }, debounceMs: 10 }),
    )

    await waitFor(() => expect(result.current.availableDraft).not.toBeNull())
    expect(result.current.availableDraft).toMatchObject({ source: 'server' })

    await act(async () => {
      const restored = await result.current.restore()
      expect(restored).toEqual({ client: 'c1', notes: 'hi' })
    })
  })

  it('falls back to a localStorage draft when the server has none', async () => {
    window.localStorage.setItem(
      'invoice_draft:new',
      JSON.stringify({ payload: { client: 'local-c' }, savedAt: '2026-06-25T09:00:00.000Z' }),
    )
    fetchMock.mockImplementation(async () => jsonResponse({ latest: null, versions: [] }))

    const { result } = renderHook(() =>
      useAutoSaveDraft({ draftKey: 'new', data: { client: '' }, debounceMs: 10 }),
    )

    await waitFor(() => expect(result.current.availableDraft).not.toBeNull())
    expect(result.current.availableDraft).toMatchObject({ source: 'local' })
    await act(async () => {
      expect(await result.current.restore()).toEqual({ client: 'local-c' })
    })
  })

  it('clear() removes the local draft and DELETEs it on the server', async () => {
    window.localStorage.setItem(
      'invoice_draft:new',
      JSON.stringify({ payload: { a: 1 }, savedAt: 't' }),
    )
    fetchMock.mockImplementation(async () => jsonResponse({ latest: null, ok: true }))

    const { result } = renderHook(() =>
      useAutoSaveDraft({ draftKey: 'new', data: { a: 1 }, debounceMs: 10 }),
    )

    await act(async () => {
      await result.current.clear()
    })

    expect(window.localStorage.getItem('invoice_draft:new')).toBeNull()
    const del = fetchMock.mock.calls.find((c) => c[1]?.method === 'DELETE')
    expect(del).toBeTruthy()
    expect(del[0]).toContain('invoiceId=new')
  })

  it('reports an error status when the server save fails', async () => {
    fetchMock.mockImplementation(async (_url: string, opts: { method?: string } = {}) => {
      const method = opts.method || 'GET'
      if (method === 'GET') return jsonResponse({ latest: null, versions: [] })
      return jsonResponse({ error: 'boom' }, false, 500)
    })

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSaveDraft({ draftKey: 'new', data, debounceMs: 10 }),
      { initialProps: { data: { client: '' } as Record<string, string> } },
    )
    rerender({ data: { client: 'c1' } })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
