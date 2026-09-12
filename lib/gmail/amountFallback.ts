// Deterministic fallback when the LLM returns null for amount.
// Scans the raw body for currency patterns, biased toward billing context.

const AMOUNT_RE = /(?:(\$|€|£)\s?(\d{1,4}(?:[.,]\d{2})?))|(?:(\d{1,4}(?:[.,]\d{2})?)\s?(USD|EUR|GBP))/gi
const CONTEXT_HINT = /(total|amount|charged|payment|due|subscription|renewal|billed|price)/i

interface FallbackAmount {
  amount: number
  currency: string
}

export function extractAmountFallback(body: string): FallbackAmount | null {
  const lines = body.split(/(?<=[.!?])\s+|\n/)
  const candidates: FallbackAmount[] = []

  for (const line of lines) {
    const hasContext = CONTEXT_HINT.test(line)
    let match: RegExpExecArray | null
    AMOUNT_RE.lastIndex = 0
    while ((match = AMOUNT_RE.exec(line)) !== null) {
      const symbol = match[1]
      const num = match[2] ?? match[3]
      const codeWord = match[4]
      if (!num) continue
      const value = parseFloat(num.replace(',', '.'))
      if (isNaN(value) || value <= 0 || value > 500) continue
      const currency = symbol === '€' ? 'EUR' : symbol === '£' ? 'GBP' : codeWord ?? 'USD'
      candidates.push({ amount: value, currency })
      if (hasContext) return { amount: value, currency }
    }
  }
  return candidates[0] ?? null
}
