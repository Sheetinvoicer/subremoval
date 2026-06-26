'use client'

import { useTranslations } from 'next-intl'
import { Palette } from 'lucide-react'
import Card from '@/components/ui/Card'
import {
  type InvoiceTemplateId,
  type InvoiceTemplateSettings,
  sanitizeAccentColor,
} from '@/lib/invoiceTemplate'

interface TemplateSelectorProps {
  value: InvoiceTemplateSettings
  onChange: (next: InvoiceTemplateSettings) => void
  /** When true, shows a hint that the invoice still uses the global default. */
  usingGlobalDefault?: boolean
}

const TEMPLATE_IDS: InvoiceTemplateId[] = ['classic', 'modern', 'minimal']

const FIELD_KEYS = [
  'showBusinessDetails',
  'showClientDetails',
  'showDueDate',
  'showNotes',
  'showStatusBadge',
] as const

const inputClass =
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
const labelClass = 'block text-sm font-medium mb-1 text-text-secondary'

/**
 * Per-invoice template picker for the editor. Edits a local
 * `InvoiceTemplateSettings` value (seeded from the invoice's
 * `metadata.template` or the user's global default) which the editor persists
 * back into `metadata.template` on save. Lets the user choose the style,
 * accent color and which sections are visible; the live preview reflects every
 * change instantly.
 */
export default function TemplateSelector({ value, onChange, usingGlobalDefault = false }: TemplateSelectorProps) {
  const t = useTranslations('invoices.editor.template')

  const setTemplate = (template: InvoiceTemplateId) => onChange({ ...value, template })
  const setAccent = (accentColor: string) => onChange({ ...value, accentColor: sanitizeAccentColor(accentColor) })
  const toggleField = (field: (typeof FIELD_KEYS)[number], checked: boolean) =>
    onChange({ ...value, fields: { ...value.fields, [field]: checked } })

  return (
    <Card hoverGlow={false}>
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-button bg-accent/10 p-1.5 text-accent">
          <Palette size={16} />
        </span>
        <h2 className="font-semibold text-text-primary">{t('heading')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="invoice-template-style" className={labelClass}>
            {t('style')}
          </label>
          <select
            id="invoice-template-style"
            value={value.template}
            onChange={(e) => setTemplate(e.target.value as InvoiceTemplateId)}
            className={inputClass}
          >
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {t(id)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invoice-template-accent" className={labelClass}>
            {t('accent')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="invoice-template-accent"
              type="color"
              value={value.accentColor}
              onChange={(e) => setAccent(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-button border border-border bg-surface"
              aria-label={t('accent')}
            />
            <span className="text-sm text-text-secondary">{value.accentColor}</span>
          </div>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-text-secondary mb-2">{t('sections')}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FIELD_KEYS.map((field) => (
            <label key={field} className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={value.fields[field]}
                onChange={(e) => toggleField(field, e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
              />
              {t(field)}
            </label>
          ))}
        </div>
      </fieldset>

      {usingGlobalDefault && <p className="mt-3 text-xs text-text-secondary">{t('usingGlobal')}</p>}
    </Card>
  )
}
