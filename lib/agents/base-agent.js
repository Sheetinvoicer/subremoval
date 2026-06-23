import { createClient } from '@/lib/supabase/server';
import callAI from '@/lib/ai/config';

export class BaseAgent {
  constructor(userId) {
    this.userId = userId;
    // The Supabase server client is now async (cookie-bound), so it cannot be
    // created in the constructor. It is initialised lazily via getClient().
    this.supabase = null;
    this.learningData = [];
    this.context = {};
  }

  async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  async getContext() {
    const supabase = await this.getClient();
    // Fetch all user data for context
    const [invoices, clients, expenses, estimates] = await Promise.all([
      supabase.from('invoices').select('*').eq('user_id', this.userId),
      supabase.from('clients').select('*').eq('user_id', this.userId),
      supabase.from('expenses').select('*').eq('user_id', this.userId),
      supabase.from('estimates').select('*').eq('user_id', this.userId),
    ]);

    this.context = {
      invoices: invoices.data || [],
      clients: clients.data || [],
      expenses: expenses.data || [],
      estimates: estimates.data || [],
      timestamp: new Date().toISOString(),
    };
    return this.context;
  }

  async learn(action, data, outcome) {
    const learningEntry = {
      user_id: this.userId,
      action,
      data,
      outcome,
      timestamp: new Date(),
    };
    
    const supabase = await this.getClient();
    await supabase.from('ai_learning').insert(learningEntry);
    this.learningData.push(learningEntry);
    
    // Analyze patterns
    if (this.learningData.length > 10) {
      await this.analyzePatterns();
    }
  }

  async analyzePatterns() {
    const recentActions = this.learningData.slice(-20);
    const prompt = `Analyze these user actions and suggest improvements:
      ${JSON.stringify(recentActions, null, 2)}
      
      Return as JSON: { patterns, suggestions, anomalies }`;
    
    const analysis = await callAI(prompt);
    return JSON.parse(analysis);
  }

  async predictNextAction() {
    const recent = this.learningData.slice(-10);
    const prompt = `Based on these recent actions, predict the user's next likely action:
      ${JSON.stringify(recent, null, 2)}
      
      Return as JSON: { predictedAction, confidence, reasoning }`;
    
    const prediction = await callAI(prompt);
    return JSON.parse(prediction);
  }
}
