'use client'

import { useTranslations } from 'next-intl'
import { formatCurrencyAmount } from '@/lib/currency'
import { resolveFontStack, type InvoiceTemplateSettings } from '@/lib/invoiceTemplate'

export interface LivePreviewItem {
  description: string
  quantity: number
  price: number
}

export interface LivePreviewMoney {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export interface LivePreviewProps {
  template: InvoiceTemplateSettings
  currency: string
  locale: string
  money: LivePreviewMoney
  items: LivePreviewItem[]
  invoiceNumber?: string
  clientName?: string
  dueDate?: string
  notes?: string
  /** Live SHA-256 verification code (shown when the seal is enabled). */
  sealCode?: string
}

/**
 * Lightweight, real-time HTML preview of the invoice being authored. It renders
 * a light "paper" surface (regardless of the dark editor theme) honoring the
 * chosen template style, accent color, logo and section visibility, and shows
 * the live money roll-ups. Money is formatted with `formatCurrencyAmount` so it
 * mirrors how the invoice will actually read for the recipient.
 */
export default function LivePreview({
  template,
  currency,
  locale,
  money,
  items,
  invoiceNumber,
  clientName,
  dueDate,
  notes,
  sealCode,
}: LivePreviewProps) {
  const t = useTranslations('invoices.editor.preview')
  const tSig = useTranslations('invoices.editor.signature')
  const accent = template.accentColor
  const { fields } = template
  const branding = template.branding
  const signature = template.signature
  const fontStack = resolveFontStack(branding?.fontFamily)
  const watermark = branding?.watermarkText?.trim() || ''
  const visibleItems = items.filter((item) => item.description.trim() !== '' || Number(item.price) > 0)
  const fmt = (value: number) => formatCurrencyAmount(value, currency, locale)

  const isModern = template.template === 'modern'
  const isMinimal = template.template === 'minimal'

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">{t('heading')}</p>
      <div
        className="relative overflow-hidden rounded-lg bg-white text-gray-900 shadow-sm"
        data-testid="invoice-live-preview"
        style={{ fontFamily: fontStack }}
      >
        {watermark ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
            data-testid="preview-watermark"
          >
            <span
              className="select-none whitespace-nowrap text-4xl font-black uppercase tracking-widest opacity-10"
              style={{ transform: 'rotate(-30deg)', color: branding?.secondaryColor || '#111827' }}
            >
              {watermark}
            </span>
          </div>
        ) : null}
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 p-4"
          style={
            isModern
              ? { backgroundColor: accent, color: '#ffffff' }
              : isMinimal
                ? { borderBottom: `1px solid #e5e7eb` }
                : { borderTop: `4px solid ${accent}` }
          }
        >
          <div className="flex items-center gap-3">
            {template.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={template.logoDataUrl} alt="" className="h-10 w-10 rounded object-contain" />
            ) : null}
            <div>
              <p
                className="text-lg font-bold leading-tight"
                style={isModern ? undefined : { color: accent }}
              >
                {t('title')}
              </p>
              {invoiceNumber ? (
                <p className={`text-xs ${isModern ? 'text-white/80' : 'text-gray-500'}`}>{invoiceNumber}</p>
              ) : null}
            </div>
          </div>
          {fields.showStatusBadge ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
              style={
                isModern
                  ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                  : { backgroundColor: `${accent}1a`, color: accent }
              }
            >
              {t('draft')}
            </span>
          ) : null}
        </div>

        <div className="space-y-4 p-4 pt-3">
          {/* Parties + due date */}
          <div className="flex flex-wrap justify-between gap-3 text-xs">
            {fields.showBusinessDetails ? (
              <div>
                <p className="font-semibold text-gray-700">{t('from')}</p>
                <p className="text-gray-500">{t('businessPlaceholder')}</p>
              </div>
            ) : null}
            {fields.showClientDetails ? (
              <div>
                <p className="font-semibold text-gray-700">{t('billTo')}</p>
                <p className="text-gray-500">{clientName || t('noClient')}</p>
              </div>
            ) : null}
            {fields.showDueDate && dueDate ? (
              <div className="text-right">
                <p className="font-semibold text-gray-700">{t('due')}</p>
                <p className="text-gray-500">{dueDate}</p>
              </div>
            ) : null}
          </div>

          {/* Items */}
          {visibleItems.length === 0 ? (
            <p className="rounded border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
              {t('empty')}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1.5 font-medium">{t('description')}</th>
                  <th className="py-1.5 text-right font-medium">{t('qty')}</th>
                  <th className="py-1.5 text-right font-medium">{t('price')}</th>
                  <th className="py-1.5 text-right font-medium">{t('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2 text-gray-800">{item.description || '—'}</td>
                    <td className="py-1.5 text-right text-gray-600">{Number(item.quantity) || 0}</td>
                    <td className="py-1.5 text-right text-gray-600">{fmt(Number(item.price) || 0)}</td>
                    <td className="py-1.5 text-right text-gray-800">
                      {fmt((Number(item.quantity) || 0) * (Number(item.price) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className="ml-auto w-full max-w-[220px] space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>{t('subtotal')}</span>
              <span>{fmt(money.subtotal)}</span>
            </div>
            {money.discountAmount > 0 ? (
              <div className="flex justify-between text-gray-600">
                <span>{t('discount')}</span>
                <span>-{fmt(money.discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-gray-600">
              <span>{t('tax')}</span>
              <span>{fmt(money.taxAmount)}</span>
            </div>
            <div
              className="flex justify-between border-t border-gray-200 pt-1 text-sm font-bold"
              style={{ color: accent }}
            >
              <span>{t('total')}</span>
              <span>{fmt(money.total)}</span>
            </div>
          </div>

          {/* Notes */}
          {fields.showNotes && notes && notes.trim() ? (
            <div className="border-t border-gray-200 pt-2 text-xs">
              <p className="font-semibold text-gray-700">{t('notes')}</p>
              <p className="whitespace-pre-wrap text-gray-500">{notes}</p>
            </div>
          ) : null}

          {/* Signature + verification seal */}
          {signature?.showSignature || (signature?.showSeal && sealCode) ? (
            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-gray-200 pt-3">
              {signature?.showSignature ? (
                <div className="text-xs" data-testid="preview-signature">
                  {signature.signatureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signature.signatureDataUrl}
                      alt=""
                      className="mb-1 h-10 w-auto max-w-[160px] object-contain"
                    />
                  ) : (
                    <div className="mb-1 h-8 w-40 border-b border-gray-400" />
                  )}
                  <p className="font-medium text-gray-700">{signature.signatureName || tSig('previewNameFallback')}</p>
                  <p className="text-gray-400">{tSig('previewSignedBy')}</p>
                </div>
              ) : (
                <span />
              )}
              {signature?.showSeal && sealCode ? (
                <div className="rounded border px-2 py-1 text-right" style={{ borderColor: accent }} data-testid="preview-seal">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
                    {tSig('previewVerification')}
                  </p>
                  <code className="font-mono text-xs text-gray-700">{sealCode}</code>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
