import { createClient } from '@/lib/supabase/client';

export class AIAgent {
  constructor() {
    this.supabase = createClient();
  }

  async processCommand(input) {
    const lower = input.toLowerCase();
    
    // CREATE INVOICE
    if (lower.includes('create invoice') || lower.includes('new invoice')) {
      // Extract client name
      let clientName = null;
      const clientPatterns = [
        /for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
        /client\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
        /to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
      ];
      
      for (const pattern of clientPatterns) {
        const match = input.match(pattern);
        if (match) {
          clientName = match[1];
          break;
        }
      }
      
      // Extract amount
      let amount = null;
      const amountPatterns = [
        /\$?(\d+(?:\.\d{2})?)/,
        /for\s+\$?(\d+(?:\.\d{2})?)/
      ];
      
      for (const pattern of amountPatterns) {
        const match = input.match(pattern);
        if (match && parseFloat(match[1]) > 0) {
          amount = parseFloat(match[1]);
          break;
        }
      }
      
      if (!clientName) {
        return { success: false, message: "Please specify a client name. Example: 'Create invoice for Beta LLC for $500'" };
      }
      
      if (!amount) {
        return { success: false, message: "Please specify an amount. Example: 'Create invoice for Beta LLC for $500'" };
      }
      
      // Find or create client
      let { data: clients } = await this.supabase
        .from('clients')
        .select('id, name')
        .ilike('name', `%${clientName}%`);
      
      let clientId = clients?.[0]?.id;
      
      if (!clientId) {
        // Create new client
        const { data: newClient } = await this.supabase
          .from('clients')
          .insert({ name: clientName, email: `${clientName.toLowerCase().replace(/\s/g, '')}@example.com` })
          .select()
          .single();
        clientId = newClient?.id;
      }
      
      if (!clientId) {
        return { success: false, message: "Could not find or create client" };
      }
      
      // Generate invoice number
      const { data: lastInvoice } = await this.supabase
        .from('invoices')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (lastInvoice && lastInvoice.length > 0) {
        const lastNum = parseInt(lastInvoice[0].invoice_number.replace('INV-', ''));
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const invoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;
      
      // Create invoice
      const { data: invoice, error } = await this.supabase
        .from('invoices')
        .insert({
          user_id: (await this.supabase.auth.getUser()).data.user?.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          subtotal: amount,
          total: amount,
          currency: 'USD',
          status: 'draft',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .select()
        .single();
      
      if (error) {
        return { success: false, message: `Error: ${error.message}` };
      }
      
      return { 
        success: true, 
        message: `✅ Created invoice ${invoiceNumber} for ${clientName} for $${amount}!`,
        invoiceId: invoice.id
      };
    }
    
    // SEND REMINDERS
    if (lower.includes('reminder') || lower.includes('follow up')) {
      const { data: overdueInvoices } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, clients(name, email)')
        .eq('status', 'sent')
        .lt('due_date', new Date().toISOString().split('T')[0]);
      
      if (!overdueInvoices || overdueInvoices.length === 0) {
        return { success: true, message: "No overdue invoices found. All good!" };
      }
      
      // Send reminders (simulated)
      return { 
        success: true, 
        message: `📧 Sent ${overdueInvoices.length} reminder${overdueInvoices.length > 1 ? 's' : ''} to overdue invoices.` 
      };
    }
    
    // GET REPORT
    if (lower.includes('report') || lower.includes('how am i doing') || lower.includes('summary')) {
      const { data: invoices } = await this.supabase
        .from('invoices')
        .select('status, total');
      
      const paidTotal = invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0) || 0;
      const pendingTotal = invoices?.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.total || 0), 0) || 0;
      const totalInvoices = invoices?.length || 0;
      const paidCount = invoices?.filter(i => i.status === 'paid').length || 0;
      
      const { data: clients } = await this.supabase.from('clients').select('id');
      
      return {
        success: true,
        message: `📊 **Your Business Report**\n\n💰 Total Revenue: $${paidTotal.toLocaleString()}\n⏳ Pending: $${pendingTotal.toLocaleString()}\n📄 Total Invoices: ${totalInvoices}\n✅ Paid: ${paidCount}\n👥 Total Clients: ${clients?.length || 0}`
      };
    }
    
    // PREDICT PAYMENT
    if (lower.includes('predict') || lower.includes('when will')) {
      let clientName = null;
      const patterns = [/client\s+([A-Z][a-z]+)/, /for\s+([A-Z][a-z]+)/, /([A-Z][a-z]+\s+[A-Z][a-z]+)/];
      
      for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
          clientName = match[1];
          break;
        }
      }
      
      if (!clientName) {
        return { success: false, message: "Which client? Example: 'Predict when Beta LLC will pay'" };
      }
      
      const { data: invoices } = await this.supabase
        .from('invoices')
        .select('created_at, paid_at, status')
        .eq('status', 'paid')
        .eq('clients.name', clientName);
      
      if (!invoices || invoices.length === 0) {
        return { success: false, message: `No payment history found for ${clientName}` };
      }
      
      let totalDays = 0;
      invoices.forEach(inv => {
        if (inv.paid_at) {
          const created = new Date(inv.created_at);
          const paid = new Date(inv.paid_at);
          const days = (paid - created) / (1000 * 60 * 60 * 24);
          totalDays += days;
        }
      });
      const avgDays = Math.round(totalDays / invoices.length);
      
      return {
        success: true,
        message: `🔮 Based on ${invoices.length} payment(s), ${clientName} typically pays in ${avgDays} days.`
      };
    }
    
    // HELP
    return {
      success: true,
      message: `🤖 **I can help you with:**\n\n📄 "Create invoice for Beta LLC for $500"\n📧 "Send reminders for overdue invoices"\n📊 "Show me my report"\n🔮 "Predict when Client X will pay"\n\nTry one of these commands!`
    };
  }
}

export const aiAgent = new AIAgent();
