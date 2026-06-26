import React from 'react'
import { render, screen } from '@testing-library/react'
import StatusTimeline from '@/components/invoices/StatusTimeline'

describe('StatusTimeline', () => {
  it('renders the happy-path lifecycle as an accessible region', () => {
    render(<StatusTimeline status="sent" />)

    const region = screen.getByRole('region', { name: 'Status timeline' })
    expect(region).toBeInTheDocument()
    for (const label of ['Draft', 'Sent', 'Viewed', 'Paid']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('marks the current status with aria-current', () => {
    render(<StatusTimeline status="sent" />)
    const current = screen.getByText('Sent').closest('li')
    expect(current).toHaveAttribute('aria-current', 'step')
    // A non-current step is not marked current.
    expect(screen.getByText('Draft').closest('li')).not.toHaveAttribute('aria-current')
  })

  it('surfaces a branch state (disputed) as a highlighted flag', () => {
    render(<StatusTimeline status="disputed" />)
    const flag = screen.getByText('Disputed')
    expect(flag).toBeInTheDocument()
    expect(flag.closest('[aria-current="step"]')).not.toBeNull()
    // No flow step is current for a branch state.
    expect(screen.getByText('Paid').closest('li')).not.toHaveAttribute('aria-current')
  })
})
