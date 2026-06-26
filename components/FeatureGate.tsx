'use client'

import { ReactNode } from 'react'
import { usePlan } from '@/hooks/usePlan'
import { hasFeature } from '@/lib/subscriptions/plans'
import UpgradePrompt from '@/components/UpgradePrompt'

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
  hideWhileLoading?: boolean
}

/**
 * Renders children only when the current user's plan grants `feature`.
 * Otherwise renders `fallback` (defaults to an UpgradePrompt). Client-side UX
 * only — server routes and the database remain the real enforcement boundary.
 */
export function FeatureGate({ feature, children, fallback, hideWhileLoading = true }: FeatureGateProps) {
  const { plan, loading } = usePlan()

  if (loading) return hideWhileLoading ? null : <>{children}</>
  if (hasFeature(plan, feature)) return <>{children}</>
  return <>{fallback ?? <UpgradePrompt />}</>
}

export default FeatureGate
