'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, memo } from 'react'
import {
  Menu,
  X,
  LogOut,
  Settings,
  LayoutDashboard,
  CreditCard,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Badge from '@/components/ui/Badge'

type NavItem = { key: string; href: string; Icon: LucideIcon; badge?: string | number }
type NavSection = { key: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', href: '/dashboard', Icon: LayoutDashboard },
    ],
  },
  {
    key: 'subscriptions',
    items: [
      { key: 'subscriptions', href: '/dashboard/subscriptions', Icon: CreditCard },
      { key: 'scan', href: '/dashboard/subscriptions/scan', Icon: ScanSearch },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'settings', href: '/dashboard/settings', Icon: Settings },
    ],
  },
]

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '')
  if (!source) return '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return source.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function Sidebar() {
  const t = useTranslations('sidebar')
  const locale = useLocale()
  const isRtl = locale === 'ar'
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('Free')
  const [subCount, setSubCount] = useState<number>(0)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setIsOpen(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const loadUser = async () => {
      if (!supabase) return
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) return

      setEmail(user.email ?? null)
      setName(
        (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          null
      )

      // SubRemoval plan comes from sr_paid_users (one-time $4.99 purchase)
      const { data: paid } = await supabase
        .from('sr_paid_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      setPlan(paid ? 'Lifetime' : 'Free')

      // Count active subscriptions for the sidebar badge
      const { count } = await supabase
        .from('sr_detected_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setSubCount(count ?? 0)
    }

    loadUser()
  }, [supabase, pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {isMobile && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
          className={`fixed top-4 z-50 bg-accent text-white p-2 rounded-button shadow-glow transition-colors duration-150 hover:bg-accent/90 ${
            isRtl ? 'right-4' : 'left-4'
          }`}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      )}

      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`
          fixed top-0 h-full z-40 w-64 bg-surface/85 backdrop-blur-xl border-border
          ${isRtl ? 'right-0 border-l' : 'left-0 border-r'}
          transition-transform duration-300 ease-out
          ${isMobile && !isOpen ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <Link href="/dashboard" className={`inline-flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-button bg-gradient-to-br from-accent to-accent-secondary text-white shadow-glow-sm">
                <CreditCard size={16} />
              </span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                SubRemoval
              </h1>
            </Link>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto p-3">
            {navSections.map((section) => (
              <div key={section.key} className="space-y-1">
                <p
                  className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary/70 ${
                    isRtl ? 'text-right' : ''
                  }`}
                >
                  {t(`sections.${section.key}`)}
                </p>
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.Icon
                  const badgeValue = item.key === 'subscriptions' && subCount > 0 ? subCount : item.badge
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => isMobile && setIsOpen(false)}
                      className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-button text-sm transition-colors duration-150 ${
                        isRtl ? 'flex-row-reverse text-right' : ''
                      } ${
                        active
                          ? 'bg-gradient-to-r from-accent/20 to-accent-secondary/10 text-accent font-semibold shadow-glow-sm'
                          : 'text-text-secondary hover:text-text-primary hover:bg-accent/10'
                      }`}
                    >
                      <span
                        className={`absolute top-1.5 bottom-1.5 w-0.5 rounded-full transition-opacity duration-150 ${
                          isRtl ? 'right-0' : 'left-0'
                        } ${active ? 'bg-accent opacity-100' : 'bg-accent opacity-0 group-hover:opacity-100'}`}
                      />
                      <Icon size={18} className="shrink-0" />
                      <span className="flex-1">{t(`items.${item.key}`)}</span>
                      {badgeValue && (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent min-w-[20px] text-center">
                          {badgeValue}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-border space-y-2">
            <div
              className={`flex items-center gap-3 px-2 py-2 rounded-card bg-card/60 ${
                isRtl ? 'flex-row-reverse text-right' : ''
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-secondary text-sm font-semibold text-white">
                {getInitials(name, email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {name || (email ? email.split('@')[0] : t('account'))}
                </p>
                <p className="truncate text-xs text-text-secondary">{email || ''}</p>
              </div>
            </div>

            <div
              className={`flex items-center justify-between px-2 ${
                isRtl ? 'flex-row-reverse' : ''
              }`}
            >
              <Badge variant={plan === 'Free' ? 'default' : 'accent'}>
                {plan === 'Free' ? 'Free plan' : 'Lifetime member'}
              </Badge>
              <Link
                href="/dashboard/settings"
                onClick={() => isMobile && setIsOpen(false)}
                aria-label={t('items.settings')}
                className="p-2 rounded-button text-text-secondary hover:text-text-primary hover:bg-accent/10 transition-colors duration-150"
              >
                <Settings size={18} />
              </Link>
            </div>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-button text-sm text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-150 ${
                isRtl ? 'flex-row-reverse text-right' : ''
              }`}
            >
              <LogOut size={18} className="shrink-0" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {!isMobile && <div className="w-64 flex-shrink-0" />}
    </>
  )
}

export default memo(Sidebar)
