'use client'

import { useCallback, useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { Skeleton } from '@/components/LoadingSkeleton'

type AuditLog = {
  id: string
  action: string
  user_email: string | null
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const actionFilters = [
  { value: '', label: 'All actions' },
  { value: 'user.role_updated', label: 'Role updated' },
  { value: 'backup.created', label: 'Backup created' },
  { value: 'backup.restored', label: 'Backup restored' },
  { value: 'gdpr.exported', label: 'Data exported' },
  { value: 'gdpr.deleted', label: 'Account deleted' },
]

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (action) params.set('action', action)

    const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, { cache: 'no-store' })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to load audit logs')
      setLoading(false)
      return
    }

    setLogs(payload.logs || [])
    setError(null)
    setLoading(false)
  }, [action])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <RoleGuard requiredRole="admin" fallback={<div className="text-red-600">Access denied.</div>}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track all user actions with timestamps.
            </p>
          </div>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-gray-900"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {actionFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

        {loading ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-gray-200 p-4 last:border-b-0 dark:border-gray-800"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-48" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No activity recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">When</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                  <th className="px-4 py-3 text-left font-semibold">User</th>
                  <th className="px-4 py-3 text-left font-semibold">Resource</th>
                  <th className="px-4 py-3 text-left font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-200 dark:border-gray-800">
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-3">{log.user_email || 'system'}</td>
                    <td className="px-4 py-3">
                      {log.resource_type
                        ? `${log.resource_type}${log.resource_id ? `:${log.resource_id}` : ''}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
