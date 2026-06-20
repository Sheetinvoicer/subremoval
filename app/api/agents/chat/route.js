import { NextResponse } from 'next/server'
import callAI from '@/lib/ai/config'

function getErrorMessage(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return error.message
  }

  return 'Failed to process AI chat request'
}

export async function POST(request) {
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const prompt = `You are a helpful AI assistant for a small business invoicing app. Reply clearly and briefly.

User message:
${message}`

    const response = await callAI(prompt)

    if (!response || typeof response !== 'string') {
      return NextResponse.json({ error: 'AI provider returned an empty response' }, { status: 502 })
    }

    return NextResponse.json({ response: response.trim() })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
