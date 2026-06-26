/**
 * Pure, dependency-free, **synchronous** SHA-256 plus a deterministic invoice
 * "verification seal".
 *
 * Deliberately free of Node's `crypto` and the async Web Crypto `subtle.digest`
 * so the seal can be computed synchronously while rendering in BOTH the browser
 * live preview and the server-side PDF, and so it is trivially unit-testable
 * against the canonical SHA-256 known-answer vectors. The implementation is the
 * standard FIPS 180-4 SHA-256; messages here are tiny (a short canonical
 * string), so a single-pass, allocation-light version is more than fast enough.
 */

// SHA-256 round constants (first 32 bits of the fractional parts of the cube
// roots of the first 64 primes).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function utf8Bytes(str: string): Uint8Array {
  // TextEncoder is universal (modern browsers + Node) — prefer it.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str)
  // Minimal manual UTF-8 encoder fallback for exotic environments.
  const out: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      out.push(code)
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const lo = str.charCodeAt(++i)
      code = 0x10000 + ((code & 0x3ff) << 10) + (lo & 0x3ff)
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return new Uint8Array(out)
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

/** Synchronous SHA-256 of a UTF-8 string, returned as 64 lowercase hex chars. */
export function sha256Hex(message: string): string {
  const bytes = utf8Bytes(message)
  const bitLen = bytes.length * 8

  // Pad: 0x80 byte, zeros until length ≡ 56 (mod 64), then a 64-bit big-endian
  // bit length.
  const withOne = bytes.length + 1
  const zeros = ((56 - (withOne % 64)) + 64) % 64
  const totalLen = withOne + zeros + 8
  const padded = new Uint8Array(totalLen)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const dv = new DataView(padded.buffer)
  dv.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000))
  dv.setUint32(totalLen - 4, bitLen >>> 0)

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const w = new Uint32Array(64)

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let a = H[0]
    let b = H[1]
    let c = H[2]
    let d = H[3]
    let e = H[4]
    let f = H[5]
    let g = H[6]
    let h = H[7]

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }

  let hex = ''
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0')
  return hex
}

export interface InvoiceSealInput {
  invoiceNumber?: string | null
  total?: number | string | null
  currency?: string | null
  issueDate?: string | null
}

export interface InvoiceSeal {
  /** The exact string that was hashed (useful for debugging/verification). */
  canonical: string
  /** Full 64-char lowercase SHA-256 hex digest. */
  hash: string
  /** Short, human-readable verification code (e.g. `A1B2-C3D4-E5F6-7890`). */
  code: string
}

// How many leading hex chars of the digest are shown in the verification code.
// 16 hex chars = 64 bits — short enough to read aloud, long enough that a
// tampered invoice will not collide in practice.
export const SEAL_CODE_HEX_LENGTH = 16

function normalizeTotal(total: InvoiceSealInput['total']): string {
  const n = Number(total)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

/**
 * Builds the stable, order-fixed canonical string that gets hashed. Changing any
 * of the bound fields (number, total, currency, issue date) changes the seal, so
 * a recipient can detect tampering by recomputing the code.
 */
export function buildSealCanonical(input: InvoiceSealInput): string {
  const number = (input.invoiceNumber ?? '').toString().trim()
  const total = normalizeTotal(input.total)
  const currency = (input.currency ?? '').toString().trim().toUpperCase()
  const issued = (input.issueDate ?? '').toString().trim()
  return `INVSEAL/v1|number=${number}|total=${total}|currency=${currency}|issued=${issued}`
}

/** Formats a hex digest into a grouped, uppercase verification code. */
export function formatSealCode(hash: string, hexLength: number = SEAL_CODE_HEX_LENGTH): string {
  const slice = hash.slice(0, hexLength).toUpperCase()
  return (slice.match(/.{1,4}/g) || [slice]).join('-')
}

/**
 * Computes the tamper-evident seal for an invoice: a deterministic SHA-256 over
 * the canonical (number + total + currency + issue date) string, exposed both as
 * the full hash and as a short grouped verification code.
 */
export function computeInvoiceSeal(input: InvoiceSealInput): InvoiceSeal {
  const canonical = buildSealCanonical(input)
  const hash = sha256Hex(canonical)
  return { canonical, hash, code: formatSealCode(hash) }
}
