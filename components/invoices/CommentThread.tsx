'use client'

import { useMemo, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { COMMENT_AUDIENCES, type CommentAudience } from '@/lib/invoices/share'
import Button from '@/components/ui/Button'

export interface CommentRecord {
  id: string
  invoice_id?: string
  parent_id?: string | null
  audience?: string | null
  body: string
  created_at?: string | null
}

export interface CommentThreadProps {
  invoiceId: string
  comments: CommentRecord[]
  /** Called after a successful add/delete so the page can refetch comments. */
  onChanged?: () => void
}

const AUDIENCE_LABEL_KEY: Record<CommentAudience, string> = {
  team: 'audienceTeam',
  client: 'audienceClient',
}

async function getAccessToken(): Promise<string | undefined> {
  const supabase = createClient()
  if (!supabase) return undefined
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}

/**
 * Threaded internal comments for the invoice detail page. Comments are owner/
 * team-only this phase and are never shown on the public share page. Adds and
 * deletes go through the authenticated `/api/invoices/comments` route (wrapped
 * in Sentry spans); the page reads the thread under RLS and refetches via
 * `onChanged`. The thread is a semantic nested list with an ARIA live region
 * announcing the result of each action.
 */
export default function CommentThread({ invoiceId, comments, onChanged }: CommentThreadProps) {
  const t = useTranslations('invoices.detail.comments')
  const locale = useLocale()

  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<CommentAudience>('team')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CommentRecord[]>()
    for (const comment of comments) {
      const key = comment.parent_id || null
      const list = map.get(key) || []
      list.push(comment)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      )
    }
    return map
  }, [comments])

  const topLevel = childrenByParent.get(null) || []

  const formatDate = (value?: string | null) => {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    } catch {
      return value
    }
  }

  async function addComment(text: string, parentId: string | null, chosenAudience: CommentAudience) {
    const trimmed = text.trim()
    if (!trimmed) return false

    return Sentry.startSpan(
      { name: 'invoices.comments.add', op: 'ui.action' },
      async (): Promise<boolean> => {
        const token = await getAccessToken()
        if (!token) {
          toast.error(t('errorLogin'))
          return false
        }
        const response = await fetch('/api/invoices/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ invoiceId, body: trimmed, audience: chosenAudience, parentId }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error((payload && payload.error) || t('errorAdd'))
        }
        return true
      },
    )
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const ok = await addComment(body, null, audience)
      if (ok) {
        setBody('')
        setAudience('team')
        toast.success(t('added'))
        onChanged?.()
      }
    } catch (err) {
      Sentry.captureException(err)
      toast.error(err instanceof Error ? err.message : t('errorAdd'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReply(event: React.FormEvent, parentId: string) {
    event.preventDefault()
    if (busyId) return
    setBusyId(parentId)
    try {
      const ok = await addComment(replyBody, parentId, 'team')
      if (ok) {
        setReplyBody('')
        setReplyTo(null)
        toast.success(t('added'))
        onChanged?.()
      }
    } catch (err) {
      Sentry.captureException(err)
      toast.error(err instanceof Error ? err.message : t('errorAdd'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (busyId) return
    setBusyId(id)
    try {
      await Sentry.startSpan({ name: 'invoices.comments.delete', op: 'ui.action' }, async () => {
        const token = await getAccessToken()
        if (!token) {
          toast.error(t('errorLogin'))
          return
        }
        const response = await fetch(`/api/invoices/comments?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error((payload && payload.error) || t('errorDelete'))
        }
        toast.success(t('deleted'))
        onChanged?.()
      })
    } catch (err) {
      Sentry.captureException(err)
      toast.error(err instanceof Error ? err.message : t('errorDelete'))
    } finally {
      setBusyId(null)
    }
  }

  function renderComment(comment: CommentRecord, depth = 0) {
    const replies = childrenByParent.get(comment.id) || []
    const audienceLabel = t(AUDIENCE_LABEL_KEY[(comment.audience as CommentAudience) || 'team'] || 'audienceTeam')
    return (
      <li key={comment.id} className={depth > 0 ? 'ms-5 border-s border-border ps-3' : ''}>
        <div className="rounded-card border border-border bg-background p-3">
          <p className="whitespace-pre-wrap text-sm text-text-primary">{comment.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span className="rounded-full bg-surface px-2 py-0.5">{audienceLabel}</span>
            <span>{formatDate(comment.created_at)}</span>
            <button
              type="button"
              onClick={() => {
                setReplyTo((prev) => (prev === comment.id ? null : comment.id))
                setReplyBody('')
              }}
              className="text-accent hover:underline"
            >
              {t('reply')}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(comment.id)}
              disabled={busyId === comment.id}
              className="text-error hover:underline disabled:opacity-50"
            >
              {busyId === comment.id ? t('deleting') : t('delete')}
            </button>
          </div>

          {replyTo === comment.id && (
            <form onSubmit={(event) => handleReply(event, comment.id)} className="mt-2 flex flex-wrap items-end gap-2">
              <label htmlFor={`reply-${comment.id}`} className="sr-only">
                {t('reply')}
              </label>
              <input
                id={`reply-${comment.id}`}
                type="text"
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder={t('replyPlaceholder')}
                className="flex-1 min-w-[12rem] rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <Button type="submit" size="sm" loading={busyId === comment.id}>
                {busyId === comment.id ? t('adding') : t('add')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setReplyTo(null)
                  setReplyBody('')
                }}
              >
                {t('cancel')}
              </Button>
            </form>
          )}
        </div>

        {replies.length > 0 && (
          <ul className="mt-2 space-y-2">{replies.map((reply) => renderComment(reply, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <section aria-label={t('heading')} className="rounded-card border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-text-secondary">{t('heading')}</h3>
      <p className="mb-3 text-xs text-text-secondary">{t('subtitle')}</p>

      <form onSubmit={handleAdd} className="mb-4 border-b border-border pb-4">
        <label htmlFor="comment-body" className="sr-only">
          {t('placeholder')}
        </label>
        <textarea
          id="comment-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('placeholder')}
          rows={2}
          className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="comment-audience" className="mb-1 block text-xs font-medium text-text-secondary">
              {t('audienceLabel')}
            </label>
            <select
              id="comment-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as CommentAudience)}
              className="rounded-button border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {COMMENT_AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {t(AUDIENCE_LABEL_KEY[value])}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" loading={submitting}>
            {submitting ? t('adding') : t('add')}
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {topLevel.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('empty')}</p>
        ) : (
          <ul className="space-y-2">{topLevel.map((comment) => renderComment(comment))}</ul>
        )}
      </div>
    </section>
  )
}
