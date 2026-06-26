'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Sparkles, X, Send, Bot, Lock } from 'lucide-react'
import { getAssistantContext } from '@/lib/dashboard/assistant-context'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = ['revenue', 'overdue', 'focus'] as const

/**
 * Floating, glass-morphism AI assistant for the dashboard. Sends the user's
 * question plus the live metrics snapshot (published by the dashboard page) to
 * `/api/agents/chat` and renders the reply. Degrades gracefully when the AI is
 * gated (Pro+) or not configured.
 */
export default function AIChatWidget() {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const isRtl = locale === 'ar'

  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: t('chat.greeting') }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context: getAssistantContext() ?? undefined }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const fallback = data?.code === 'feature_locked' ? t('chat.locked') : t('chat.error')
        setMessages((prev) => [...prev, { role: 'assistant', content: fallback }])
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data?.response || t('chat.error') }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chat.error') }])
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  const side = isRtl ? 'left-6' : 'right-6'

  return (
    <>
      {/* Launcher */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t('chat.open')}
          className={`fixed bottom-6 ${side} z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-secondary text-white shadow-glow-lg transition-transform duration-250 hover:scale-110 active:scale-95 motion-reduce:transform-none`}
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-20" />
          <Sparkles size={24} className="relative" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-6 ${side} z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-card border border-border bg-card/80 shadow-glow-lg backdrop-blur-xl`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-accent to-accent-secondary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bot size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{t('chat.title')}</p>
                <p className="text-[11px] text-white/80">{t('chat.subtitle')}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label={t('chat.close')} className="rounded-full p-1 transition-colors hover:bg-white/20">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface/70 text-text-primary'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-card border border-border bg-surface/70 px-3 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                </div>
              </div>
            )}

            {/* Suggested prompts (only before the first user turn) */}
            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    onClick={() => send(t(`chat.suggestions.${key}`))}
                    className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary"
                  >
                    {t(`chat.suggestions.${key}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder={t('chat.placeholder')}
              aria-label={t('chat.placeholder')}
              autoComplete="off"
              className="flex-1 rounded-button border border-border bg-surface/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label={t('chat.send')}
              className="flex h-9 w-9 items-center justify-center rounded-button bg-accent text-white transition-all duration-250 hover:bg-accent/90 hover:shadow-glow-sm disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>

          <p className="flex items-center justify-center gap-1 pb-2 text-[10px] text-text-secondary">
            <Lock size={10} /> {t('chat.privacy')}
          </p>
        </div>
      )}
    </>
  )
}
