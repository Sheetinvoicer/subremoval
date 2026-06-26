'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface UpgradePromptProps {
  message?: string
  className?: string
  /**
   * When set, the CTA scrolls to the element with this id on the current page
   * (used on the subscription page to jump to the plans grid) instead of
   * navigating to the subscription route.
   */
  scrollToId?: string
}

/**
 * Small inline call-to-action shown when a feature or limit is gated by plan.
 */
export function UpgradePrompt({ message, className, scrollToId }: UpgradePromptProps) {
  const t = useTranslations('subscriptionPlans.gate')

  const ctaClass =
    'inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium'

  function handleScrollToPlans() {
    if (!scrollToId) return
    const target = document.getElementById(scrollToId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center ${className ?? ''}`}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{message ?? t('featureLocked')}</p>
      {scrollToId ? (
        <button type="button" onClick={handleScrollToPlans} className={ctaClass}>
          {t('upgradeCta')}
        </button>
      ) : (
        <Link href="/dashboard/subscription#plans" className={ctaClass}>
          {t('upgradeCta')}
        </Link>
      )}
    </div>
  )
}

export default UpgradePrompt
