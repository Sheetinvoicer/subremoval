'use client'

import { ReactNode, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasRequiredRole, normalizeRole } from '@/lib/auth/roles'

type RoleGuardProps = {
  requiredRole: 'admin' | 'staff' | 'viewer'
  children: ReactNode
  fallback?: ReactNode
}

export default function RoleGuard({ requiredRole, children, fallback = null }: RoleGuardProps) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient()
      if (!supabase) {
        setLoading(false)
        setAllowed(false)
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        setAllowed(false)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      const userRole = normalizeRole(data?.role)
      setAllowed(hasRequiredRole(userRole, requiredRole))
      setLoading(false)
    }

    checkRole()
  }, [requiredRole])

  if (loading) return null
  if (!allowed) return <>{fallback}</>

  return <>{children}</>
}
