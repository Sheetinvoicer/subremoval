import {
  buildSealCanonical,
  computeInvoiceSeal,
  formatSealCode,
  sha256Hex,
} from '@/lib/invoices/seal'

describe('sha256Hex (FIPS 180-4 known-answer vectors)', () => {
  it('hashes the empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('hashes "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('hashes the 56-byte multi-block message', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('hashes a long (1M chars would be slow) UTF-8 string deterministically', () => {
    expect(sha256Hex('Über-Rechnung — €1.234,56')).toHaveLength(64)
    expect(sha256Hex('Über-Rechnung — €1.234,56')).toBe(sha256Hex('Über-Rechnung — €1.234,56'))
  })
})

describe('computeInvoiceSeal', () => {
  const base = { invoiceNumber: 'INV-1001', total: 1234.5, currency: 'usd', issueDate: '2026-06-25' }

  it('is deterministic and currency/total-normalized', () => {
    const a = computeInvoiceSeal(base)
    const b = computeInvoiceSeal({ ...base, currency: 'USD', total: '1234.50' })
    expect(a.hash).toBe(b.hash)
    expect(a.code).toBe(b.code)
    expect(a.hash).toHaveLength(64)
  })

  it('produces a grouped 16-hex verification code', () => {
    const { hash, code } = computeInvoiceSeal(base)
    expect(code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/)
    expect(code.replace(/-/g, '')).toBe(hash.slice(0, 16).toUpperCase())
  })

  it('changes when any bound field changes (tamper-evident)', () => {
    const original = computeInvoiceSeal(base).hash
    expect(computeInvoiceSeal({ ...base, total: 1234.51 }).hash).not.toBe(original)
    expect(computeInvoiceSeal({ ...base, invoiceNumber: 'INV-1002' }).hash).not.toBe(original)
    expect(computeInvoiceSeal({ ...base, currency: 'EUR' }).hash).not.toBe(original)
    expect(computeInvoiceSeal({ ...base, issueDate: '2026-06-26' }).hash).not.toBe(original)
  })

  it('handles missing/invalid fields without throwing', () => {
    const seal = computeInvoiceSeal({ invoiceNumber: null, total: 'nope', currency: undefined, issueDate: null })
    expect(seal.hash).toHaveLength(64)
    expect(buildSealCanonical({ total: 'nope' })).toContain('total=0.00')
  })
})

describe('formatSealCode', () => {
  it('uppercases and groups in fours', () => {
    expect(formatSealCode('abcdef0123456789ffffffff')).toBe('ABCD-EF01-2345-6789')
  })
})
