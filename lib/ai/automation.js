import { createClient } from '@/lib/supabase/client';

export class AIAutomation {
  constructor() {
    this.supabase = createClient();
  }

  // ============================================
  // 1. SMART INVOICE AUTOMATION
  // ============================================
  
  async autoCreateRecurringInvoices() {
    // Find all active recurring invoices
    const { data: recurring } = await this.supabase
      .from('recurring_invoices')
      .select('*, clients(*)')
      .eq('status', 'active')
      .lte('next_send_date', new Date().toISOString());
    
    const created = [];
    for (const rec of recurring) {
      // Create new invoice
      const invoiceNumber = `INV-${String(Date.now()).slice(-8)}`;
      const { data: invoice } = await this.supabase.from('invoices').insert({
        user_id: rec.user_id,
        client_id: rec.client_id,
        invoice_number: invoiceNumber,
        total: rec.amount,
        currency: rec.currency || 'USD',
        status: 'sent',
        due_date: new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0]
      }).select().single();
      
      // Update next send date
      const nextDate = new Date();
      if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      if (rec.frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      
      await this.supabase.from('recurring_invoices')
        .update({ next_send_date: nextDate.toISOString().split('T')[0] })
        .eq('id', rec.id);
      
      created.push(invoice);
      
      // Send email notification
      await this.sendInvoiceEmail(invoice, rec.clients);
    }
    
    return created;
  }
  
  // ============================================
  // 2. SMART PAYMENT FOLLOW-UPS
  // ============================================
  
  async autoSendPaymentReminders() {
    // Find overdue invoices (7+ days past due)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: overdue } = await this.supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('status', 'sent')
      .lt('due_date', sevenDaysAgo.toISOString().split('T')[0]);
    
    const reminders = [];
    for (const inv of overdue) {
      // Send reminder email
      await this.sendReminderEmail(inv, inv.clients);
      
      // Log reminder
      reminders.push({ invoice: inv.invoice_number, client: inv.clients?.name });
    }
    
    return reminders;
  }
  
  // ============================================
  // 3. SMART CASH FLOW PREDICTION
  // ============================================
  
  async predictCashFlow(userId, days = 30) {
    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId);
    
    const paidInvoices = invoices?.filter(i => i.status === 'paid') || [];
    const avgMonthlyRevenue = paidInvoices.reduce((s, i) => s + (i.total || 0), 0) / Math.max(1, new Date().getMonth() + 1);
    
    const pendingInvoices = invoices?.filter(i => i.status !== 'paid') || [];
    const expectedCollection = pendingInvoices.reduce((s, i) => s + (i.total || 0), 0);
    
    const { data: expenses } = await this.supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId);
    
    const avgMonthlyExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) / Math.max(1, new Date().getMonth() + 1);
    
    const predictedCashFlow = avgMonthlyRevenue - avgMonthlyExpenses;
    
    return {
      predictedRevenue: avgMonthlyRevenue,
      predictedExpenses: avgMonthlyExpenses,
      predictedCashFlow: predictedCashFlow,
      expectedCollection: expectedCollection,
      risk: predictedCashFlow < 0 ? 'HIGH' : (predictedCashFlow < 1000 ? 'MEDIUM' : 'LOW'),
      recommendation: predictedCashFlow < 0 ? 'Send payment reminders to pending invoices immediately' : 'Your cash flow is healthy'
    };
  }
  
  // ============================================
  // 4. SMART CLIENT INSIGHTS
  // ============================================
  
  async getClientInsights(clientId) {
    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('client_id', clientId);
    
    const paidInvoices = invoices?.filter(i => i.status === 'paid') || [];
    const pendingInvoices = invoices?.filter(i => i.status !== 'paid') || [];
    
    const totalPaid = paidInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalPending = pendingInvoices.reduce((s, i) => s + (i.total || 0), 0);
    
    // Calculate average payment time
    let avgPaymentDays = 0;
    paidInvoices.forEach(inv => {
      if (inv.paid_at) {
        const created = new Date(inv.created_at);
        const paid = new Date(inv.paid_at);
        avgPaymentDays += (paid - created) / (1000 * 60 * 60 * 24);
      }
    });
    avgPaymentDays = avgPaymentDays / (paidInvoices.length || 1);
    
    return {
      totalInvoices: invoices?.length || 0,
      totalPaid: totalPaid,
      totalPending: totalPending,
      averagePaymentDays: avgPaymentDays.toFixed(1),
      riskLevel: avgPaymentDays > 30 ? 'HIGH' : (avgPaymentDays > 15 ? 'MEDIUM' : 'LOW'),
      recommendation: avgPaymentDays > 30 ? 'Consider requesting upfront payment' : 'Good payment history'
    };
  }

  // ============================================
  // 5. SEND EMAILS (Helper)
  // ============================================
  
  async sendInvoiceEmail(invoice, client) {
    // Integrate with your Resend email system
    console.log(`Sending invoice ${invoice.invoice_number} to ${client?.email}`);
    // Call your existing email API
  }
  
  async sendReminderEmail(invoice, client) {
    console.log(`Sending reminder for invoice ${invoice.invoice_number} to ${client?.email}`);
  }
}

export const aiAutomation = new AIAutomation();
