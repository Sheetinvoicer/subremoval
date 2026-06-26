'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  FilePlus2,
  UserPlus,
  ReceiptText,
  ClipboardList,
  Repeat,
  BarChart3,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Card from '@/components/ui/Card'

interface QuickAction {
  key: string
  href: string
  icon: LucideIcon
  iconClass: string
}

const ACTIONS: QuickAction[] = [
  { key: 'newInvoice', href: '/dashboard/invoices/new', icon: FilePlus2, iconClass: 'text-accent bg-accent/10' },
  { key: 'newClient', href: '/dashboard/clients/new', icon: UserPlus, iconClass: 'text-sky-400 bg-sky-400/10' },
  { key: 'newExpense', href: '/dashboard/expenses/new', icon: ReceiptText, iconClass: 'text-amber-400 bg-amber-400/10' },
  { key: 'newEstimate', href: '/dashboard/estimates/new', icon: ClipboardList, iconClass: 'text-emerald-400 bg-emerald-400/10' },
  { key: 'recurring', href: '/dashboard/recurring/new', icon: Repeat, iconClass: 'text-fuchsia-400 bg-fuchsia-400/10' },
  { key: 'reports', href: '/dashboard/reports', icon: BarChart3, iconClass: 'text-indigo-400 bg-indigo-400/10' },
]

/**
 * Quick-action launcher: a compact grid of one-tap shortcuts to the most common
 * "create" flows plus reports. Navigation only — no data access.
 */
export default function QuickActions({ className = '' }: { className?: string }) {
  const t = useTranslations('dashboard')
  const router = useRouter()

  return (
    <Card hoverGlow={false} className={className}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-button bg-accent/15 text-accent">
          <Zap size={15} />
        </span>
        <h2 className="font-semibold text-text-primary">{t('quickActions.title')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.key}
              onClick={() => router.push(action.href)}
              className="group flex flex-col items-center gap-2 rounded-card border border-border bg-surface/50 p-3 text-center transition-all duration-250 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/5 hover:shadow-glow-sm motion-reduce:hover:translate-y-0"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-button ${action.iconClass} transition-transform duration-250 group-hover:scale-110 motion-reduce:transform-none`}>
                <Icon size={18} />
              </span>
              <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary">
                {t(`quickActions.${action.key}`)}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
