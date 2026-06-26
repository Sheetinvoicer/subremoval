import {
  COMMENT_AUDIENCES,
  SHARE_TOKEN_BYTES,
  generateShareToken,
  isCommentAudience,
  isShareLinkActive,
  sanitizePublicInvoice,
  shareLinkPath,
  shareLinkState,
} from '@/lib/invoices/share'

describe('generateShareToken', () => {
  it('returns 64 lowercase hex chars (256 bits) by default', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(SHARE_TOKEN_BYTES * 2)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('honors a custom byte length and falls back on invalid input', () => {
    expect(generateShareToken(16)).toHaveLength(32)
    // Non-positive / non-integer lengths fall back to the default.
    expect(generateShareToken(0)).toHaveLength(SHARE_TOKEN_BYTES * 2)
    expect(generateShareToken(-4)).toHaveLength(SHARE_TOKEN_BYTES * 2)
  })

  it('produces unique tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()))
    expect(tokens.size).toBe(50)
  })
})

describe('shareLinkState / isShareLinkActive', () => {
  const now = new Date('2026-06-25T12:00:00.000Z')

  it('treats a link with no expiry and no revocation as active', () => {
    expect(shareLinkState({}, now)).toBe('active')
    expect(isShareLinkActive({ expires_at: null, revoked_at: null }, now)).toBe(true)
  })

  it('is active while the expiry is in the future', () => {
    expect(shareLinkState({ expires_at: '2026-06-25T12:00:01.000Z' }, now)).toBe('active')
  })

  it('is expired once the expiry has passed, with the boundary treated as expired', () => {
    expect(shareLinkState({ expires_at: '2026-06-25T11:59:59.000Z' }, now)).toBe('expired')
    expect(shareLinkState({ expires_at: '2026-06-25T12:00:00.000Z' }, now)).toBe('expired')
    expect(isShareLinkActive({ expires_at: '2026-06-25T12:00:00.000Z' }, now)).toBe(false)
  })

  it('treats a revoked link as revoked even if not yet expired', () => {
    expect(
      shareLinkState({ expires_at: '2026-06-25T12:00:01.000Z', revoked_at: '2026-06-25T11:00:00.000Z' }, now),
    ).toBe('revoked')
  })
})

describe('shareLinkPath', () => {
  it('builds the public path and encodes the token', () => {
    expect(shareLinkPath('abc123')).toBe('/invoice/abc123')
    expect(shareLinkPath('a/b c')).toBe('/invoice/a%2Fb%20c')
  })
})

describe('isCommentAudience', () => {
  it('accepts only the known audiences', () => {
    expect(COMMENT_AUDIENCES).toEqual(['team', 'client'])
    expect(isCommentAudience('team')).toBe(true)
    expect(isCommentAudience('client')).toBe(true)
    expect(isCommentAudience('public')).toBe(false)
    expect(isCommentAudience(5)).toBe(false)
  })
})

describe('sanitizePublicInvoice', () => {
  const fullRow = {
    id: 'inv-1',
    user_id: 'secret-user',
    invoice_number: 'INV-1001',
    status: 'sent',
    currency: 'EUR',
    subtotal: 100,
    tax_rate_percentage: 20,
    tax_amount: 20,
    total: 120,
    due_date: '2026-07-01',
    created_at: '2026-06-01T00:00:00.000Z',
    client_name: 'ACME GmbH',
    notes: 'internal only - do not leak',
    metadata: { secret: true },
    tags: ['internal'],
    clients: { name: 'ACME GmbH', email: 'billing@acme.example' },
    items: [
      { description: 'Design', quantity: 2, price: 25, total: 50, secretCost: 5 },
      { description: 'Dev', quantity: 1, price: 50 },
    ],
  }

  it('keeps only whitelisted display fields and drops sensitive ones', () => {
    const result = sanitizePublicInvoice(fullRow) as Record<string, unknown>
    expect(result).toEqual({
      invoiceNumber: 'INV-1001',
      status: 'sent',
      currency: 'EUR',
      subtotal: 100,
      taxRatePercentage: 20,
      taxAmount: 20,
      total: 120,
      dueDate: '2026-07-01',
      createdAt: '2026-06-01T00:00:00.000Z',
      clientName: 'ACME GmbH',
      items: [
        { description: 'Design', quantity: 2, price: 25, total: 50 },
        { description: 'Dev', quantity: 1, price: 50, total: 50 },
      ],
    })
    // No sensitive fields survive sanitization.
    expect(result.user_id).toBeUndefined()
    expect(result.notes).toBeUndefined()
    expect(result.metadata).toBeUndefined()
    expect(result.id).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('billing@acme.example')
    expect(JSON.stringify(result)).not.toContain('secretCost')
  })

  it('falls back to the embedded client name and defaults currency', () => {
    const result = sanitizePublicInvoice({
      invoice_number: 'INV-2',
      clients: { name: 'Globex' },
    })
    expect(result.clientName).toBe('Globex')
    expect(result.currency).toBe('USD')
    expect(result.items).toEqual([])
  })

  it('coerces missing/invalid numbers to 0 and handles a null invoice', () => {
    const result = sanitizePublicInvoice(null)
    expect(result.total).toBe(0)
    expect(result.subtotal).toBe(0)
    expect(result.clientName).toBeNull()
    expect(result.items).toEqual([])
  })
})
