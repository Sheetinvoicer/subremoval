import { createClient } from '@/lib/supabase/client'

export async function generateInvoiceNumber(userId) {
  const supabase = createClient()
  
  // Get the last invoice number for this user
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  let nextNumber = 1
  
  if (lastInvoice?.invoice_number) {
    const match = lastInvoice.invoice_number.match(/INV-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }
  
  // Format: INV-000001 (6 digits)
  const formattedNumber = `INV-${nextNumber.toString().padStart(6, '0')}`
  
  return formattedNumber
}
