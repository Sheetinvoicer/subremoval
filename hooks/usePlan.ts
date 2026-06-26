'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_PLAN,
  getLimit,
  getPlan,
  hasFeature as planHasFeature,
  isUnlimited as planIsUnlimited,
  normalizePlanName,
} from '@/lib/subscriptions/plans'

/**
 * Client hook exposing the current user's plan and convenience gating helpers.
 * This is for UX only (showing badges, upgrade prompts, disabling buttons);
 * the authoritative enforcement lives server-side and in the database.
 */
export function usePlan() {
  const [plan, setPlan] = useState<string>(DEFAULT_PLAN)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const supabase = createClient()
        if (!supabase) {
          if (active) setLoading(false)
          return
        }
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (active) {
            setPlan(DEFAULT_PLAN)
            setLoading(false)
          }
          return
        }
        const { data } = await supabase
          .from('subscriptions')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle()
        if (active) setPlan(normalizePlanName(data?.plan))
      } catch {
        if (active) setPlan(DEFAULT_PLAN)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const hasFeature = useCallback((feature: string) => planHasFeature(plan, feature), [plan])
  const limitFor = useCallback((key: string) => getLimit(plan, key), [plan])
  const isUnlimited = useCallback((key: string) => planIsUnlimited(plan, key), [plan])

  return { plan, planDef: getPlan(plan), loading, hasFeature, getLimit: limitFor, isUnlimited }
}

export default usePlan
