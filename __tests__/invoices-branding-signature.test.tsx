import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import BrandingControls from '@/components/invoices/BrandingControls'
import SignatureSeal from '@/components/invoices/SignatureSeal'
import {
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  type InvoiceTemplateSettings,
} from '@/lib/invoiceTemplate'

describe('BrandingControls', () => {
  it('updates typography and watermark through onChange', () => {
    const onChange = jest.fn()
    render(<BrandingControls value={DEFAULT_INVOICE_TEMPLATE_SETTINGS} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Typography'), { target: { value: 'serif' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ branding: expect.objectContaining({ fontFamily: 'serif' }) }),
    )

    fireEvent.change(screen.getByLabelText('Watermark'), { target: { value: 'PAID' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ branding: expect.objectContaining({ watermarkText: 'PAID' }) }),
    )
  })
})

describe('SignatureSeal', () => {
  function Harness() {
    const [value, setValue] = React.useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_TEMPLATE_SETTINGS)
    return <SignatureSeal value={value} onChange={setValue} sealCode="A1B2-C3D4-E5F6-7890" />
  }

  it('reveals the verification code only when the seal is enabled', () => {
    render(<Harness />)
    expect(screen.queryByTestId('seal-preview')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Add a verification seal'))

    expect(screen.getByTestId('seal-preview')).toBeInTheDocument()
    expect(screen.getByText('A1B2-C3D4-E5F6-7890')).toBeInTheDocument()
  })

  it('reveals the typed-name field when a signature is enabled', () => {
    render(<Harness />)
    expect(screen.queryByLabelText('Signed by')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Add a signature'))

    expect(screen.getByLabelText('Signed by')).toBeInTheDocument()
  })
})
