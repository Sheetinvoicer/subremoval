'use client'

import { useEffect, useState } from 'react'
import { SettingsSkeleton } from '@/components/LoadingSkeleton'

interface StatusResponse {
  enabled: boolean
  hasBackupCodes: boolean
}

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [setupCode, setSetupCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setLoading(true)
    setError('')
    const response = await fetch('/api/auth/2fa?action=status')
    const data: StatusResponse & { error?: string } = await response.json()

    if (!response.ok) {
      setError(data.error || 'Failed to load 2FA status')
    } else {
      setEnabled(data.enabled)
    }

    setLoading(false)
  }

  async function startSetup() {
    setError('')
    setSuccess('')

    const response = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup' }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Failed to initialize 2FA')
      return
    }

    setQrCodeDataUrl(data.qrCodeDataUrl)
    setSetupCode(data.otpauthUrl)
  }

  async function verifySetup() {
    setError('')
    setSuccess('')

    const response = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-setup', code: verificationCode }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Failed to verify setup code')
      return
    }

    setEnabled(true)
    setBackupCodes(data.backupCodes || [])
    setSuccess('Two-factor authentication enabled successfully.')
    setQrCodeDataUrl('')
    setSetupCode('')
    setVerificationCode('')
  }

  async function disableTwoFactor() {
    setError('')
    setSuccess('')

    const response = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Failed to disable 2FA')
      return
    }

    setEnabled(false)
    setBackupCodes([])
    setSuccess('Two-factor authentication disabled.')
  }

  if (loading) {
    return <SettingsSkeleton sections={2} />
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Security</h1>

      {error && <div className="rounded-lg bg-red-100 text-red-700 px-4 py-3">{error}</div>}
      {success && <div className="rounded-lg bg-green-100 text-green-700 px-4 py-3">{success}</div>}

      <div className="rounded-xl border p-4 space-y-4">
        <div>
          <h2 className="font-medium">Two-Factor Authentication (2FA)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Protect your account with an authenticator app and backup codes.
          </p>
        </div>

        {!enabled ? (
          <>
            {!qrCodeDataUrl ? (
              <button onClick={startSetup} className="px-4 py-2 rounded-lg bg-blue-600 text-white">
                Set up 2FA
              </button>
            ) : (
              <div className="space-y-3">
                <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48 border rounded" />
                <p className="text-xs break-all text-gray-500">Manual setup key: {setupCode}</p>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full rounded-lg border px-3 py-2"
                />
                <button onClick={verifySetup} className="px-4 py-2 rounded-lg bg-green-600 text-white">
                  Verify & Enable
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-green-700">2FA is currently enabled.</div>
            <button onClick={disableTwoFactor} className="px-4 py-2 rounded-lg bg-red-600 text-white">
              Disable 2FA
            </button>
          </div>
        )}
      </div>

      {backupCodes.length > 0 && (
        <div className="rounded-xl border p-4">
          <h3 className="font-medium mb-2">Backup Codes</h3>
          <p className="text-sm text-gray-500 mb-3">Save these one-time backup codes in a safe place.</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((code) => (
              <div key={code} className="rounded bg-gray-100 px-2 py-1">
                {code}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
