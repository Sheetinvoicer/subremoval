'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'

const roles = ['admin', 'staff', 'viewer'] as const

type UserItem = {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'staff' | 'viewer'
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    const response = await fetch('/api/admin/users', { cache: 'no-store' })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to load users')
      setLoading(false)
      return
    }

    setUsers(payload.users || [])
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const updateRole = async (userId: string, role: UserItem['role']) => {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })

    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Failed to update user role')
      return
    }

    setUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, role } : item)))
  }

  return (
    <RoleGuard requiredRole="admin" fallback={<div className="text-red-600">Access denied.</div>}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage team roles and access levels.</p>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

        {loading ? (
          <div className="text-gray-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-gray-200 dark:border-gray-800">
                    <td className="px-4 py-3">{user.full_name || '-'}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-gray-900"
                        value={user.role}
                        onChange={(event) => updateRole(user.id, event.target.value as UserItem['role'])}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
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
