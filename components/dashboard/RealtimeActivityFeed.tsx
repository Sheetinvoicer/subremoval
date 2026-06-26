'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity as ActivityIcon,
  FileText,
  CheckCircle2,
  Mail,
  UserPlus,
  ReceiptText,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'

interface ActivityRow {
  id: string
  type: string
  description: string
  created_at: string
}

const ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  invoice_created: { icon: FileText, className: 'text-accent bg-accent/10' },
  invoice_paid: { icon: CheckCircle2, className: 'text-success bg-success/10' },
  invoice_sent: { icon: Mail, className: 'text-sky-400 bg-sky-400/10' },
  client_added: { icon: UserPlus, className: 'text-fuchsia-400 bg-fuchsia-400/10' },
  expense_added: { icon: ReceiptText, className: 'text-amber-400 bg-amber-400/10' },
}

function iconFor(type: string) {
  return ICONS[type] ?? { icon: ActivityIcon, className: 'text-text-secondary bg-surface' }
}

function relativeTime(iso: string, justNow: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return justNow
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

/**
 * Real-time activity feed backed by the `activity_logs` Supabase table. Subscribes
 * to live `postgres_changes` when the client supports it and degrades gracefully
 * (no crash, friendly empty state) when the table, realtime channel or data are
 * unavailable.
 */
export default function RealtimeActivityFeed({ className = '' }: { className?: string }) {
  const t = useTranslations('dashboard')
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null

    let supabase: ReturnType<typeof createClient> | null = null
    try {
      supabase = createClient()
    } catch {
      supabase = null
    }
    supabaseRef.current = supabase

    const load = async () => {
      try {
        if (!supabase || typeof supabase.from !== 'function') return
        let query: any = supabase.from('activity_logs').select('id, type, description, created_at') // eslint-disable-line @typescript-eslint/no-explicit-any
        if (query && typeof query.order === 'function') {
          query = query.order('created_at', { ascending: false })
        }
        if (query && typeof query.limit === 'function') {
          query = query.limit(8)
        }
        const result = await query
        const data = result?.data
        if (!cancelled && !result?.error && Array.isArray(data)) {
          setActivities(data as ActivityRow[])
        }
      } catch {
        /* ignore — keep the empty state */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    try {
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase
          .channel('dashboard-activity')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => load())
          .subscribe()
        if (!cancelled) setLive(true)
      }
    } catch {
      /* realtime not available — static feed still works */
    }

    return () => {
      cancelled = true
      try {
        if (channel && supabase && typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(channel)
        }
      } catch {
        /* noop */
      }
    }
  }, [])

  return (
    <Card hoverGlow={false} className={`flex flex-col ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-button bg-accent/15 text-accent">
            <ActivityIcon size={15} />
          </span>
          <div>
            <h2 className="font-semibold leading-tight text-text-primary">{t('activity.title')}</h2>
            <p className="text-xs text-text-secondary">{t('activity.subtitle')}</p>
          </div>
        </div>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            {t('activity.live')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-button bg-surface/60" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Inbox size={22} className="text-accent" />
          </div>
          <p className="text-sm font-medium text-text-primary">{t('activity.empty')}</p>
          <p className="mt-1 max-w-[14rem] text-xs text-text-secondary">{t('activity.emptyHint')}</p>
        </div>
      ) : (
        <ul className="-mr-1 max-h-80 space-y-1 overflow-y-auto pr-1">
          {activities.map((activity) => {
            const { icon: Icon, className: iconClass } = iconFor(activity.type)
            return (
              <li
                key={activity.id}
                className="flex items-start gap-3 rounded-button p-2 transition-colors duration-150 hover:bg-accent/5"
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-button ${iconClass}`}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{activity.description}</p>
                  <p className="text-xs text-text-secondary">{relativeTime(activity.created_at, t('activity.justNow'))}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
