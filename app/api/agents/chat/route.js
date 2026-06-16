import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { message, userId } = await request.json();
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `You are an AI assistant for SheetInvoicer. Help users with:
- Creating and managing invoices
- Client management
- Financial analysis
- Payment tracking
- Business insights

Be friendly, professional, and concise. Keep responses under 150 words.`,
      messages: [
        { role: 'user', content: message }
      ],
    });
    
    return NextResponse.json({ 
      response: response.content[0].text,
      success: true 
    });
    
  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ 
      error: error.message,
      response: 'Sorry, I encountered an error. Please try again.'
    }, { status: 500 });
  }
}
