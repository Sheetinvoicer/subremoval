'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface UpgradePromptProps {
  message?: string
  className?: string
}

/**
 * Small inline call-to-action shown when a feature or limit is gated by plan.
 */
export function UpgradePrompt({ message, className }: UpgradePromptProps) {
  const t = useTranslations('subscriptionPlans.gate')
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center ${className ?? ''}`}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{message ?? t('featureLocked')}</p>
      <Link
        href="/dashboard/subscription"
        className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
      >
        {t('upgradeCta')}
      </Link>
    </div>
  )
}

export default UpgradePrompt
