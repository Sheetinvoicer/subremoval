import { BaseAgent } from './base-agent';
import callAI from '@/lib/ai/config';

export class ClientAgent extends BaseAgent {
  constructor(userId) {
    super(userId);
  }

  async analyzeClient(clientId) {
    await this.getContext();
    const client = this.context.clients.find(c => c.id === clientId);
    const clientInvoices = this.context.invoices.filter(i => i.client_id === clientId);
    
    const paidInvoices = clientInvoices.filter(i => i.status === 'paid');
    const totalPaid = paidInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const pendingInvoices = clientInvoices.filter(i => i.status !== 'paid');
    const totalPending = pendingInvoices.reduce((s, i) => s + (i.total || 0), 0);
    
    let avgPaymentDays = 0;
    paidInvoices.forEach(inv => {
      if (inv.paid_at) {
        const created = new Date(inv.created_at);
        const paid = new Date(inv.paid_at);
        avgPaymentDays += (paid - created) / (1000 * 60 * 60 * 24);
      }
    });
    avgPaymentDays = avgPaymentDays / (paidInvoices.length || 1);
    
    const prompt = `Analyze this client and provide insights:
      Client: ${JSON.stringify(client)}
      Invoices: ${JSON.stringify(clientInvoices)}
      Total Paid: $${totalPaid}
      Total Pending: $${totalPending}
      Average Payment Days: ${avgPaymentDays}
      
      Return as JSON: {
        riskLevel: "low|medium|high",
        paymentReliability: "excellent|good|poor",
        recommendedAction: string,
        insights: string[],
        nextBestAction: string
      }`;
    
    const analysis = await callAI(prompt);
    const insights = JSON.parse(analysis);
    
    await this.learn('client_analysis', { clientId, analysis: insights }, { success: true });
    
    return {
      client,
      metrics: { totalPaid, totalPending, avgPaymentDays, invoiceCount: clientInvoices.length },
      insights,
      recommendations: insights.recommendedAction,
    };
  }

  async suggestPaymentTerms(clientId) {
    const analysis = await this.analyzeClient(clientId);
    
    const prompt = `Based on this client's payment behavior, suggest optimal payment terms:
      ${JSON.stringify(analysis)}
      
      Return as JSON: {
        recommendedTerms: "net7|net14|net30|net60",
        depositPercentage: number,
        reason: string,
        alternativeOptions: string[]
      }`;
    
    const suggestions = await callAI(prompt);
    return JSON.parse(suggestions);
  }

  async predictClientChurn(clientId) {
    const analysis = await this.analyzeClient(clientId);
    const lastInvoice = this.context.invoices
      .filter(i => i.client_id === clientId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    
    const daysSinceLastInvoice = lastInvoice 
      ? (Date.now() - new Date(lastInvoice.created_at)) / (1000 * 60 * 60 * 24)
      : null;
    
    const prompt = `Predict churn risk for this client:
      Analysis: ${JSON.stringify(analysis)}
      Days since last invoice: ${daysSinceLastInvoice}
      Total invoices: ${analysis.metrics.invoiceCount}
      
      Return as JSON: {
        churnRisk: "high|medium|low",
        probability: number,
        reason: string,
        retentionStrategy: string
      }`;
    
    const prediction = await callAI(prompt);
    return JSON.parse(prediction);
  }

  async autoSegmentClients() {
    await this.getContext();
    
    const prompt = `Segment these clients into strategic groups based on their behavior:
      ${JSON.stringify(this.context.clients.map(c => ({
        name: c.name,
        invoiceCount: this.context.invoices.filter(i => i.client_id === c.id).length,
        totalPaid: this.context.invoices.filter(i => i.client_id === c.id && i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0),
        lastInvoiceDate: this.context.invoices.filter(i => i.client_id === c.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at
      })), null, 2)}
      
      Return as JSON: {
        segments: [{
          name: string,
          clients: string[],
          characteristics: string[],
          strategy: string
        }]
      }`;
    
    const segmentation = await callAI(prompt);
    return JSON.parse(segmentation);
  }
}
