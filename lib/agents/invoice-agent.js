import { BaseAgent } from './base-agent';
import callAI from '@/lib/ai/config';

export class InvoiceAgent extends BaseAgent {
  constructor(userId) {
    super(userId);
  }

  async analyzeInvoicePerformance() {
    await this.getContext();
    
    const paidInvoices = this.context.invoices.filter(i => i.status === 'paid');
    const avgValue = paidInvoices.reduce((s, i) => s + (i.total || 0), 0) / (paidInvoices.length || 1);
    const avgPaymentTime = this.calculateAvgPaymentTime(paidInvoices);
    
    const prompt = `Analyze invoice performance and provide optimization suggestions:
      Total Invoices: ${this.context.invoices.length}
      Paid Invoices: ${paidInvoices.length}
      Average Invoice Value: $${avgValue}
      Average Payment Time: ${avgPaymentTime} days
      Currencies Used: ${[...new Set(this.context.invoices.map(i => i.currency))]}
      
      Return as JSON: {
        metrics: {
          collectionRate: number,
          averageValue: number,
          paymentVelocity: number
        },
        insights: string[],
        recommendations: {
          immediate: string[],
          longTerm: string[]
        },
        optimizationScore: number
      }`;
    
    const analysis = await callAI(prompt);
    await this.learn('invoice_performance_analysis', {}, { success: true });
    
    return JSON.parse(analysis);
  }

  calculateAvgPaymentTime(paidInvoices) {
    let totalDays = 0;
    paidInvoices.forEach(inv => {
      if (inv.paid_at) {
        const created = new Date(inv.created_at);
        const paid = new Date(inv.paid_at);
        totalDays += (paid - created) / (1000 * 60 * 60 * 24);
      }
    });
    return totalDays / (paidInvoices.length || 1);
  }

  async predictLatePayment(invoiceId) {
    const invoice = this.context.invoices.find(i => i.id === invoiceId);
    if (!invoice) return null;
    
    const clientInvoices = this.context.invoices.filter(i => i.client_id === invoice.client_id && i.status === 'paid');
    
    let avgClientPaymentDays = 0;
    clientInvoices.forEach(inv => {
      if (inv.paid_at) {
        const created = new Date(inv.created_at);
        const paid = new Date(inv.paid_at);
        avgClientPaymentDays += (paid - created) / (1000 * 60 * 60 * 24);
      }
    });
    avgClientPaymentDays = avgClientPaymentDays / (clientInvoices.length || 1);
    
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const daysUntilDue = Math.max(0, (dueDate - today) / (1000 * 60 * 60 * 24));
    
    const prompt = `Predict late payment probability for this invoice:
      Invoice Amount: $${invoice.total}
      Due in: ${daysUntilDue} days
      Client Avg Payment Time: ${avgClientPaymentDays} days
      
      Return as JSON: {
        lateProbability: number,
        expectedPaymentDay: number,
        riskLevel: "low|medium|high",
        recommendedAction: string
      }`;
    
    const prediction = await callAI(prompt);
    return JSON.parse(prediction);
  }

  async optimizePaymentReminders() {
    await this.getContext();
    
    const overdueInvoices = this.context.invoices.filter(i => 
      i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()
    );
    
    const prompt = `Optimize payment reminder strategy for ${overdueInvoices.length} overdue invoices:
      Analyze optimal reminder timing, wording, and channel.
      
      Return as JSON: {
        reminderSchedule: {
          day1: string,
          day3: string,
          day7: string,
          day14: string
        },
        recommendedTemplates: {
          firstReminder: string,
          secondReminder: string,
          finalNotice: string
        },
        expectedRecoveryRate: number
      }`;
    
    const optimization = await callAI(prompt);
    return JSON.parse(optimization);
  }

  async autoGenerateInvoiceTemplate(clientId, amount, currency = 'USD') {
    const client = this.context.clients.find(c => c.id === clientId);
    const similarInvoices = this.context.invoices
      .filter(i => i.client_id === clientId)
      .slice(0, 5);
    
    const prompt = `Generate a professional invoice template for:
      Client: ${client?.name}
      Amount: $${amount} ${currency}
      Previous Invoices: ${JSON.stringify(similarInvoices)}
      
      Generate as JSON: {
        lineItems: [{ description: string, quantity: number, unitPrice: number, total: number }],
        notes: string,
        terms: string,
        dueDays: number
      }`;
    
    const template = await callAI(prompt);
    return JSON.parse(template);
  }
}
