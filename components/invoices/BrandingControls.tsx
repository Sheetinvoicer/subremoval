'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Brush, Upload, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  type InvoiceFontFamily,
  type InvoiceTemplateSettings,
  sanitizeHexColor,
  DEFAULT_INVOICE_BRANDING_SETTINGS,
} from '@/lib/invoiceTemplate'

interface BrandingControlsProps {
  value: InvoiceTemplateSettings
  onChange: (next: InvoiceTemplateSettings) => void
}

const FONT_FAMILIES: InvoiceFontFamily[] = ['sans', 'serif', 'mono']

// Reject oversized logos so we never bloat the invoice's metadata JSONB.
const MAX_LOGO_BYTES = 512 * 1024

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
 * Per-invoice branding controls (Enterprise `customBranding` feature). Edits the
 * logo, a secondary brand color, typography and an optional watermark — all
 * stored in `InvoiceTemplateSettings` (persisted to `metadata.template`) and
 * reflected live in the preview / final PDF.
 */
export default function BrandingControls({ value, onChange }: BrandingControlsProps) {
  const t = useTranslations('invoices.editor.branding')
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const watermarkId = useId()
  const fontId = useId()
  const secondaryId = useId()

  const branding = value.branding ?? DEFAULT_INVOICE_BRANDING_SETTINGS

  const setBranding = (patch: Partial<InvoiceTemplateSettings['branding']>) =>
    onChange({ ...value, branding: { ...branding, ...patch } })

  const onLogoSelected = async (file: File | undefined) => {
    setLogoError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError(t('logoTypeError'))
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t('logoSizeError'))
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      onChange({ ...value, logoDataUrl: dataUrl })
    } catch {
      setLogoError(t('logoReadError'))
    }
  }

  return (
    <Card hoverGlow={false}>
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-button bg-accent/10 p-1.5 text-accent">
          <Brush size={16} />
        </span>
        <h2 className="font-semibold text-text-primary">{t('heading')}</h2>
      </div>

      {/* Logo */}
      <div className="mb-4">
        <span className={labelClass}>{t('logo')}</span>
        <div className="flex items-center gap-3">
          {value.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.logoDataUrl}
              alt={t('logoPreviewAlt')}
              className="h-10 w-auto max-w-[140px] rounded border border-border bg-white object-contain p-1"
            />
          ) : (
            <span className="text-xs text-text-secondary">{t('noLogo')}</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLogoSelected(e.target.files?.[0])}
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} aria-hidden="true" />
            {t('uploadLogo')}
          </Button>
          {value.logoDataUrl && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange({ ...value, logoDataUrl: '' })}
              aria-label={t('removeLogo')}
            >
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
        {logoError && (
          <p className="mt-1 text-xs text-red-500" role="alert">
            {logoError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Secondary color */}
        <div>
          <label htmlFor={secondaryId} className={labelClass}>
            {t('secondaryColor')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={secondaryId}
              type="color"
              value={branding.secondaryColor}
              onChange={(e) =>
                setBranding({ secondaryColor: sanitizeHexColor(e.target.value, branding.secondaryColor) })
              }
              className="h-9 w-12 cursor-pointer rounded-button border border-border bg-surface"
            />
            <span className="text-sm text-text-secondary">{branding.secondaryColor}</span>
          </div>
        </div>

        {/* Typography */}
        <div>
          <label htmlFor={fontId} className={labelClass}>
            {t('typography')}
          </label>
          <select
            id={fontId}
            value={branding.fontFamily}
            onChange={(e) => setBranding({ fontFamily: e.target.value as InvoiceFontFamily })}
            className={inputClass}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {t(`fonts.${font}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Watermark */}
      <div className="mt-4">
        <label htmlFor={watermarkId} className={labelClass}>
          {t('watermark')}
        </label>
        <input
          id={watermarkId}
          type="text"
          value={branding.watermarkText}
          maxLength={40}
          placeholder={t('watermarkPlaceholder')}
          onChange={(e) => setBranding({ watermarkText: e.target.value })}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-text-secondary">{t('watermarkHint')}</p>
      </div>
    </Card>
  )
}
