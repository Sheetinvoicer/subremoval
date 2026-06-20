'use client'

import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })
      const data = await response.json()
      const assistantMessage: Message = { role: 'assistant', content: data.response || 'No response' }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = { role: 'assistant', content: 'Error occurred. Please try again.' }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 h-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col border border-gray-200 dark:border-gray-700">
      <div className="p-3 bg-blue-600 text-white rounded-t-lg">
        <h3 className="font-semibold">AI Assistant</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-4">
            <p>👋 Ask me anything!</p>
            <p className="text-xs mt-2">Try: "Create invoice", "Show reports", or "Help"</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-900 ml-8' : 'bg-gray-100 dark:bg-gray-700 mr-8'}`}>
            <p className="text-sm">{msg.content}</p>
          </div>
        ))}
        {loading && <div className="text-gray-500 text-sm">Thinking...</div>}
      </div>
      <div className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your command..."
          className="flex-1 p-2 border rounded-lg text-sm dark:bg-gray-700"
        />
        <button onClick={sendMessage} disabled={loading} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  )
}
