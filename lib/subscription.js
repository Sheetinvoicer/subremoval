import { createClient } from '@/lib/supabase/client'

export async function canCreateInvoice(userId, newInvoiceCount = 1) {
  const supabase = createClient()
  
  // Get user's plan from user_profiles table
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()
  
  if (profileError) {
    console.error('Error fetching user plan:', profileError)
  }
  
  const planType = profile?.plan?.toLowerCase() || 'free'
  
  // Count existing invoices
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error counting invoices:', error)
    return { allowed: true, message: null }
  }
  
  const currentCount = count || 0
  const wouldExceed = currentCount + newInvoiceCount > 5
  
  console.log(`[Subscription Check] Plan: ${planType}, Invoices: ${currentCount}, Would exceed 5: ${wouldExceed}`)
  
  // Free plan: max 5 invoices
  if (planType === 'free' && wouldExceed) {
    const remaining = 5 - currentCount
    return { 
      allowed: false, 
      message: `Free plan limited to 5 invoices. You have ${currentCount}/5. Upgrade to Pro for unlimited invoices.` 
    }
  }
  
  // Pro or Business: unlimited
  if (planType === 'pro' || planType === 'business') {
    console.log('Paid plan detected - unlimited invoices allowed')
    return { allowed: true, message: null }
  }
  
  return { allowed: true, message: null }
}
