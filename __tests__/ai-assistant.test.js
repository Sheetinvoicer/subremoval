import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIAssistant from '@/components/AIAssistant'

describe('AIAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('shows API error message when chat endpoint returns non-OK response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    render(<AIAssistant />)

    await userEvent.click(screen.getByLabelText(/open ai assistant/i))
    await userEvent.type(screen.getByLabelText(/send message/i).previousElementSibling, 'Help with invoices')
    await userEvent.click(screen.getByLabelText(/send message/i))

    await waitFor(() => {
      expect(screen.getByText('Sorry, I could not process that.')).toBeInTheDocument()
    })
  })
})
