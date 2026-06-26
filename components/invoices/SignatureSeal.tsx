'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PenLine, ShieldCheck, Upload, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  type InvoiceTemplateSettings,
  DEFAULT_INVOICE_SIGNATURE_SETTINGS,
} from '@/lib/invoiceTemplate'

interface SignatureSealProps {
  value: InvoiceTemplateSettings
  onChange: (next: InvoiceTemplateSettings) => void
  /** Live verification code computed from the current invoice (see lib/invoices/seal.ts). */
  sealCode: string
}

const MAX_SIGNATURE_BYTES = 256 * 1024

const inputClass =
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
const labelClass = 'block text-sm font-medium mb-1 text-text-secondary'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

/**
 * Digital signature + tamper-evident seal controls (Enterprise `customBranding`
 * feature). The signature is a typed name and/or an uploaded/drawn image; the
 * seal is a SHA-256 verification code derived from the invoice and shown live so
 * the user can see exactly what a recipient would verify.
 */
export default function SignatureSeal({ value, onChange, sealCode }: SignatureSealProps) {
  const t = useTranslations('invoices.editor.signature')
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const nameId = useId()

  const signature = value.signature ?? DEFAULT_INVOICE_SIGNATURE_SETTINGS

  const setSignature = (patch: Partial<InvoiceTemplateSettings['signature']>) =>
    onChange({ ...value, signature: { ...signature, ...patch } })

  const onImageSelected = async (file: File | undefined) => {
    setImageError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError(t('imageTypeError'))
      return
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setImageError(t('imageSizeError'))
      return
    }
    try {
      setSignature({ signatureDataUrl: await readFileAsDataUrl(file) })
    } catch {
      setImageError(t('imageReadError'))
    }
  }

  return (
    <Card hoverGlow={false}>
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-button bg-accent/10 p-1.5 text-accent">
          <PenLine size={16} />
        </span>
        <h2 className="font-semibold text-text-primary">{t('heading')}</h2>
      </div>

      {/* Signature */}
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={signature.showSignature}
          onChange={(e) => setSignature({ showSignature: e.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        {t('showSignature')}
      </label>

      {signature.showSignature && (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={nameId} className={labelClass}>
              {t('signatureName')}
            </label>
            <input
              id={nameId}
              type="text"
              value={signature.signatureName}
              maxLength={80}
              placeholder={t('signatureNamePlaceholder')}
              onChange={(e) => setSignature({ signatureName: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <span className={labelClass}>{t('signatureImage')}</span>
            <div className="flex items-center gap-3">
              {signature.signatureDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signature.signatureDataUrl}
                  alt={t('signatureImageAlt')}
                  className="h-10 w-auto max-w-[160px] rounded border border-border bg-white object-contain p-1"
                />
              ) : (
                <span className="text-xs text-text-secondary">{t('noSignatureImage')}</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onImageSelected(e.target.files?.[0])}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={14} aria-hidden="true" />
                {t('uploadSignature')}
              </Button>
              {signature.signatureDataUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSignature({ signatureDataUrl: '' })}
                  aria-label={t('removeSignature')}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              )}
            </div>
            {imageError && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                {imageError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Seal */}
      <div className="mt-4 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={signature.showSeal}
            onChange={(e) => setSignature({ showSeal: e.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          {t('showSeal')}
        </label>
        <p className="mt-1 text-xs text-text-secondary">{t('sealHint')}</p>

        {signature.showSeal && (
          <div
            className="mt-2 flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2"
            data-testid="seal-preview"
          >
            <ShieldCheck size={16} className="text-accent" aria-hidden="true" />
            <span className="text-xs text-text-secondary">{t('sealCodeLabel')}</span>
            <code className="font-mono text-sm tracking-wider text-text-primary">{sealCode}</code>
          </div>
        )}
      </div>
    </Card>
  )
}
