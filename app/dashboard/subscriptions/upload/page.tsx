'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react'

function UploadPageInner() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ detected: number; inserted: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  function pickFile(f: File) {
    setFile(f)
    setError(null)
    setResult(null)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  async function upload() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/bank/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      setResult({
        detected: data.detected,
        inserted: data.inserted ?? 0,
        updated: data.updated ?? 0,
      })
      setTimeout(() => router.push('/dashboard/subscriptions'), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard/subscriptions"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to subscriptions
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload bank statement</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Upload 2-3 months of statements (PDF or CSV) from any bank or credit card.
            We&apos;ll detect every recurring subscription in under 90 seconds.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Scan complete!</p>
              <p className="text-sm">
                Found {result.detected} subscriptions. Redirecting…
              </p>
            </div>
          </div>
        )}

        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              borderRadius: 20,
              border: `2px dashed ${dragActive ? '#8B7CF6' : '#3a3f52'}`,
              background: dragActive ? 'rgba(139,124,246,0.08)' : 'transparent',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pickFile(f)
              }}
              style={{ display: 'none' }}
            />

            <div
              style={{
                display: 'inline-flex',
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(139,124,246,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Upload className="h-7 w-7 text-purple-600" />
            </div>

            {file ? (
              <>
                <p className="font-semibold text-gray-900 dark:text-white text-lg">
                  {file.name}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {(file.size / 1024).toFixed(0)} KB · Ready to scan
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-900 dark:text-white text-lg">
                  Drop your statement here
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  or click to browse · PDF or CSV · Max 5 MB
                </p>
              </>
            )}
          </div>
        )}

        {file && !result && (
          <button
            onClick={upload}
            disabled={uploading}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing your statement…
              </>
            ) : (
              <>
                <FileText className="h-5 w-5" />
                Scan statement
              </>
            )}
          </button>
        )}

        <div className="mt-8 space-y-2 text-xs text-gray-500 dark:text-gray-400">
          <p>🔒 Your file is analyzed and immediately discarded. Nothing is stored.</p>
          <p>📊 Works with Chase, Bank of America, Wells Fargo, Capital One, and any other bank.</p>
          <p>💡 Tip: CSV exports scan faster and more accurately than PDFs.</p>
        </div>
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <UploadPageInner />
    </Suspense>
  )
}
