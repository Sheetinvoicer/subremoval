'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown, ExternalLink, RotateCw,
  ShieldCheck, ShieldAlert, ShieldQuestion, X, ArrowLeft,
  CreditCard, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Confidence = 'high' | 'medium' | 'low'

interface Sub {
  id: string
  service_name: string
  domain: string | null
  amount: number | null
  currency: string | null
  billing_cycle: string | null
  cancel_url: string | null
  confidence: Confidence
  amount_source: 'ai' | 'regex_fallback' | 'known_directory' | null
  last_payment_status: 'success' | 'failed' | 'cancelled_by_provider' | 'trial_ending' | 'unknown' | null
  rationale: string | null
  source: string | null
  last_seen_at: string | null
}

const FX: Record<string, number> = { USD: 1, EUR: 1.085, GBP: 1.27, JPY: 0.0067 }

const CONFIDENCE: Record<Confidence, { label: string; icon: any; tone: string }> = {
  high: { label: 'Confirmed', icon: ShieldCheck, tone: '#3DD68C' },
  medium: { label: 'Needs a look', icon: ShieldQuestion, tone: '#E8B339' },
  low: { label: 'Possibly not yours', icon: ShieldAlert, tone: '#E8654B' },
}

const BRAND_COLORS = [
  '#E50914','#1DB954','#5865F2','#FF7A00','#6E56CF',
  '#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6',
  '#EC4899','#14B8A6','#F97316','#6366F1',
]

function brandColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length]
}

function getInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function toUSD(amount: number | null, currency: string | null) {
  if (amount == null) return null
  const rate = FX[currency ?? 'USD'] ?? 1
  return amount * rate
}

function money(amount: number | null, currency: string | null) {
  if (amount == null) return null
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  return `${symbol}${amount.toFixed(2)}`
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'review'>('all')
  const [sort, setSort] = useState<'cost' | 'confidence'>('cost')

  async function load() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('You must be logged in.'); setLoading(false); return }
    const { data, error } = await supabase
      .from('sr_detected_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
    if (error) setError(error.message)
    else setSubs((data ?? []) as Sub[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markNotMine(sub: Sub) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const domain = sub.domain ?? `${sub.service_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    await supabase.from('sr_user_excluded_domains').insert({
      user_id: session.user.id,
      domain,
    }).select()
    setSubs((prev) => prev.filter((s) => s.id !== sub.id))
    setOpenId(null)
  }

  const filtered = useMemo(() => {
    let list = subs
    if (filter === 'review') list = list.filter((s) => s.confidence !== 'high')
    return [...list].sort((a, b) => {
      if (sort === 'confidence') {
        const order = { low: 0, medium: 1, high: 2 }
        return order[a.confidence] - order[b.confidence]
      }
      const av = toUSD(a.amount, a.currency) ?? -1
      const bv = toUSD(b.amount, b.currency) ?? -1
      return bv - av
    })
  }, [subs, filter, sort])

  const confirmedTotal = subs
    .filter((s) => s.confidence !== 'low' && s.amount != null)
    .reduce((sum, s) => sum + (toUSD(s.amount, s.currency) ?? 0), 0)

  const confirmedCount = subs.filter((s) => s.confidence !== 'low').length
  const needsReview = subs.filter((s) => s.confidence !== 'high').length
  const annualTotal = confirmedTotal * 12

  return (
    <div
      style={{
        '--bg': '#0E1016',
        '--panel': '#171A24',
        '--panel-line': '#262A38',
        '--text': '#EDEFF5',
        '--text-dim': '#9297AA',
        '--accent': '#8B7CF6',
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
        padding: '32px 20px 80px',
      } as React.CSSProperties}
    >
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        {/* HERO CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1a1d29 0%, #232735 100%)',
            border: '1px solid var(--panel-line)',
            borderRadius: 20,
            padding: '32px 28px',
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,124,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
            <CreditCard size={13} /> Your monthly drain
          </div>

          <div style={{ fontSize: 52, fontWeight: 800, marginTop: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: -2, lineHeight: 1 }}>
            ${confirmedTotal.toFixed(2)}
            <span style={{ fontSize: 18, color: 'var(--text-dim)', fontWeight: 500, marginLeft: 8, letterSpacing: 0 }}>/mo</span>
          </div>

          <div style={{ fontSize: 15, color: 'var(--text-dim)', marginTop: 10 }}>
            That&apos;s <strong style={{ color: 'var(--text)' }}>${annualTotal.toFixed(0)}</strong> per year — across {confirmedCount} active subscriptions
          </div>

          {needsReview > 0 && (
            <div style={{ marginTop: 22, padding: '12px 14px', background: 'rgba(232,179,57,0.1)', border: '1px solid rgba(232,179,57,0.3)', borderRadius: 10, color: '#E8B339', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={15} />
              <span><strong>{needsReview}</strong> {needsReview === 1 ? 'subscription needs' : 'subscriptions need'} review — confirm or cancel them to clean up your list</span>
            </div>
          )}

          <Link
            href="/dashboard/subscriptions/scan"
            style={{
              marginTop: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: '#12101C',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            <RotateCw size={15} /> Rescan inbox
          </Link>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: '#3D1A1A', border: '1px solid #7D2A2A', color: '#F5B0B0' }}>
            {error}
          </div>
        )}

        {/* FILTERS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['all', 'review'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--panel-line)' : 'transparent',
                border: '1px solid var(--panel-line)',
                color: filter === f ? 'var(--text)' : 'var(--text-dim)',
                borderRadius: 9,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? `All (${subs.length})` : `Needs review (${needsReview})`}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'cost' | 'confidence')}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-line)',
              color: 'var(--text-dim)',
              borderRadius: 9,
              padding: '7px 12px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <option value="cost">Sort by cost</option>
            <option value="confidence">Sort by confidence</option>
          </select>
        </div>

        {/* LIST */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-line)', borderRadius: 16, overflow: 'hidden' }}>
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
              Nothing here. Rescan your inbox to look for new charges.
            </div>
          )}

          {filtered.map((item, idx) => {
            const conf = CONFIDENCE[item.confidence] ?? CONFIDENCE.medium
            const Icon = conf.icon
            const isOpen = openId === item.id
            const usd = toUSD(item.amount, item.currency)
            const annual = usd != null ? usd * 12 : null
            const initials = getInitials(item.service_name)
            const bg = brandColor(item.service_name)
            const isFailed = item.last_payment_status === 'failed'
            const hasAmount = item.amount != null
            const priceLabel = money(item.amount, item.currency)

            return (
              <div key={item.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--panel-line)' }}>
                <div
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', cursor: 'pointer' }}
                >
                  {/* LOGO */}
                  <div
                    style={{
                      width: 42, height: 42, borderRadius: 11,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: 14,
                      flexShrink: 0, letterSpacing: 0.5,
                    }}
                  >
                    {initials}
                  </div>

                  {/* NAME + META */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--text)' }}>{item.service_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <Icon size={12} color={conf.tone} />
                      <span style={{ fontSize: 12.5, color: conf.tone, fontWeight: 600 }}>{conf.label}</span>
                      <span style={{ color: 'var(--panel-line)' }}>·</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                        {isFailed ? (
                          <span style={{ color: '#E8654B', fontWeight: 600 }}>Payment issue — check your card</span>
                        ) : item.last_seen_at ? (
                          `Last charged ${new Date(item.last_seen_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        ) : (
                          'No charge date found'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* AMOUNT */}
                  <div style={{ textAlign: 'right', minWidth: 90, flexShrink: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {priceLabel ?? <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500 }}>Check statement</span>}
                    </div>
                    {annual != null && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                        ${annual.toFixed(0)}/yr
                      </div>
                    )}
                  </div>

                  {/* CANCEL */}
                  {item.cancel_url ? (
                    <a
                      href={item.cancel_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: 'var(--accent)', fontSize: 13.5, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 4,
                        textDecoration: 'none', flexShrink: 0,
                      }}
                    >
                      Cancel <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12.5, flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
                      No link
                    </span>
                  )}

                  <ChevronDown
                    size={18}
                    color="var(--text-dim)"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}
                  />
                </div>

                {isOpen && (
                  <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <p style={{ color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.6, maxWidth: 460, margin: 0 }}>
                      {item.rationale ?? 'No rationale provided.'}
                    </p>
                    <button
                      onClick={() => markNotMine(item)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--panel-line)',
                        color: 'var(--text-dim)',
                        borderRadius: 8,
                        padding: '7px 12px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <X size={13} /> Not a subscription
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
