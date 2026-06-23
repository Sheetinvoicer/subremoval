'use client'

import { ReactNode, useEffect, useState } from 'react'
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
      try {
        // Use the server endpoint so the email-based admin bootstrap is applied
        // consistently with the middleware and admin APIs.
        const res = await fetch('/api/auth/role', { cache: 'no-store' })
        const payload = await res.json().catch(() => null)

        if (!res.ok || !payload?.role) {
          setAllowed(false)
          return
        }

        const userRole = normalizeRole(payload.role)
        setAllowed(hasRequiredRole(userRole, requiredRole))
      } catch {
        setAllowed(false)
      } finally {
        setLoading(false)
      }
    }

    checkRole()
  }, [requiredRole])

  if (loading) return null
  if (!allowed) return <>{fallback}</>

  return <>{children}</>
}
