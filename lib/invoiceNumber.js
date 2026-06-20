import { createClient } from '@/lib/supabase/client'

export async function generateInvoiceNumber(userId) {
  const supabase = createClient()
  if (!supabase || !userId) {
    return `INV-${Math.floor(1000 + Math.random() * 9000)}`
  }
  
  // Format requested: INV-XXXX (4 digits), unique per user
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = Math.floor(1000 + Math.random() * 9000)
    const formattedNumber = `INV-${value}`

    const { data: existing, error } = await supabase
      .from('invoices')
      .select('id')
      .eq('user_id', userId)
      .eq('invoice_number', formattedNumber)
      .maybeSingle()

    if (error) {
      continue
    }

    if (!existing) {
      return formattedNumber
    }
  }

  const timestampSuffix = String(Date.now()).slice(-4)
  return `INV-${timestampSuffix}`
}
