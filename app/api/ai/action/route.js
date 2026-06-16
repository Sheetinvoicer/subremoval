import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

// Initialize both
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { action, data } = await request.json();
    
    let result;
    
    switch (action) {
      case 'generate-invoice':
        result = await generateInvoice(data);
        break;
      case 'analyze-finances':
        result = await analyzeFinances(data);
        break;
      case 'predict-payment':
        result = await predictPayment(data);
        break;
      case 'suggest-amount':
        result = await suggestAmount(data);
        break;
      case 'summarize':
        result = await summarizeData(data);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('AI Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Use Claude with correct model names
async function generateInvoice(data) {
  const { clientName, items, description } = data;
  
  const prompt = `Generate a professional invoice for:
Client: ${clientName}
Services: ${items || 'Consulting services'}
Description: ${description || 'Professional services rendered'}

Return as JSON with fields: description, suggestedItems (array of {item, quantity, rate}), totalAmount, paymentTerms, invoiceNumber`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',  // ✅ CORRECT model name
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { result: response.content[0].text };
  }
}

async function analyzeFinances(data) {
  const { invoices, expenses, period } = data;
  
  const prompt = `Analyze this financial data:
Invoices: ${JSON.stringify(invoices)}
Expenses: ${JSON.stringify(expenses)}
Period: ${period}

Return as JSON with fields: revenue, expenses, profit, insights, recommendations (array)`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',  // ✅ CORRECT - fastest for analysis
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  
  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { result: response.content[0].text };
  }
}

async function predictPayment(data) {
  const { clientHistory, invoiceAmount, dueDate } = data;
  
  const prompt = `Predict payment behavior for:
Client History: ${JSON.stringify(clientHistory)}
Invoice Amount: $${invoiceAmount}
Due Date: ${dueDate}

Return as JSON with fields: probability (number 0-100), expectedDate, riskLevel (low/medium/high), followUpSchedule`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',  // ✅ CORRECT
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  
  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { result: response.content[0].text };
  }
}

async function suggestAmount(data) {
  const { serviceType, marketRate, clientBudget } = data;
  
  const prompt = `Suggest optimal pricing for:
Service: ${serviceType}
Market Rate: $${marketRate}/hour
Client Budget: $${clientBudget}

Return as JSON with fields: recommendedRate, projectTotal, strategy, competitivePosition`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',  // ✅ CORRECT
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  
  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { result: response.content[0].text };
  }
}

async function summarizeData(data) {
  const { type, content } = data;
  
  const prompt = `Summarize this ${type} data in 2-3 sentences:
${JSON.stringify(content)}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',  // ✅ CORRECT - fastest
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return { summary: response.content[0].text };
}
