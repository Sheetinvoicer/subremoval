'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, Loader2, Bot, User } from 'lucide-react'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Admin AI assistant — a chat surface that doubles as AI-powered search over
 * platform data. Posts to /api/admin/ai/chat (admin-guarded) with a trimmed
 * rolling history so follow-up questions keep context.
 */
export default function AdminAIAssistant() {
  const t = useTranslations('adminAi')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const suggestions = [
    t('assistant.suggestions.activeUsers'),
    t('assistant.suggestions.anomalies'),
    t('assistant.suggestions.roles'),
    t('assistant.suggestions.revenue'),
  ]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || loading) return

    setError(null)
    const history = messages.slice(-10)
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error || t('assistant.error'))
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: payload?.response || t('assistant.empty') },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('assistant.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    send(input)
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <Sparkles className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('assistant.title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('assistant.subtitle')}</p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[420px] min-h-[220px] space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('assistant.empty')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:border-accent hover:text-accent dark:border-gray-700 dark:text-gray-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('assistant.thinking')}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-200 p-3 dark:border-gray-800">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('assistant.placeholder')}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={t('assistant.send')}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  )
}
