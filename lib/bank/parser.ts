// Extracts plain text from bank statement files (PDF or CSV).
// No storage — text is processed in-memory and discarded.

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.csv')) {
    return extractFromCsv(buffer)
  }
  if (lower.endsWith('.pdf')) {
    return extractFromPdf(buffer)
  }
  throw new Error('Unsupported file type. Use PDF or CSV.')
}

function extractFromCsv(buffer: Buffer): string {
  // CSV is already text. Just clean it up.
  const raw = buffer.toString('utf-8')
  return raw.slice(0, 50000) // 50k chars max
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid Turbopack build issues
  const mod = await import('pdf-parse')
  // The package exports either named `pdfParse` or the module itself
  const parseFn = (mod as any).pdfParse ?? (mod as any).default ?? mod
  const data = await parseFn(buffer)
  // Bank statements can be huge — cap at 50k chars
  return data.text.slice(0, 50000)
}
