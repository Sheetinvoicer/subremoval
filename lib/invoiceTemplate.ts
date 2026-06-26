export type InvoiceTemplateId = 'classic' | 'modern' | 'minimal'

export interface InvoiceFieldVisibility {
  showBusinessDetails: boolean
  showClientDetails: boolean
  showDueDate: boolean
  showNotes: boolean
  showStatusBadge: boolean
}

// Typography options surfaced by the branding controls (Phase 6).
export type InvoiceFontFamily = 'sans' | 'serif' | 'mono'

// Branding (Phase 6): typography, a secondary brand color and an optional
// watermark, layered on top of the existing accent color + logo.
export interface InvoiceBrandingSettings {
  fontFamily: InvoiceFontFamily
  secondaryColor: string
  watermarkText: string
}

// Digital signature + tamper-evident seal (Phase 6). The seal's verification
// code is DERIVED from the invoice (see lib/invoices/seal.ts) and is never
// stored here; this only toggles whether it is rendered.
export interface InvoiceSignatureSettings {
  showSignature: boolean
  signatureName: string
  signatureDataUrl: string
  showSeal: boolean
}

export interface InvoiceTemplateSettings {
  template: InvoiceTemplateId
  accentColor: string
  logoDataUrl: string
  fields: InvoiceFieldVisibility
  branding: InvoiceBrandingSettings
  signature: InvoiceSignatureSettings
}

export const DEFAULT_INVOICE_BRANDING_SETTINGS: InvoiceBrandingSettings = {
  fontFamily: 'sans',
  secondaryColor: '#1e293b',
  watermarkText: '',
}

export const DEFAULT_INVOICE_SIGNATURE_SETTINGS: InvoiceSignatureSettings = {
  showSignature: false,
  signatureName: '',
  signatureDataUrl: '',
  showSeal: false,
}

export const DEFAULT_INVOICE_TEMPLATE_SETTINGS: InvoiceTemplateSettings = {
  template: 'classic',
  accentColor: '#2563eb',
  logoDataUrl: '',
  fields: {
    showBusinessDetails: true,
    showClientDetails: true,
    showDueDate: true,
    showNotes: true,
    showStatusBadge: true,
  },
  branding: DEFAULT_INVOICE_BRANDING_SETTINGS,
  signature: DEFAULT_INVOICE_SIGNATURE_SETTINGS,
}

export const INVOICE_TEMPLATE_STORAGE_KEY = 'invoice_template_settings'

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/

export function sanitizeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_REGEX.test(value) ? value : fallback
}

export function sanitizeAccentColor(color: string | null | undefined): string {
  return sanitizeHexColor(color, DEFAULT_INVOICE_TEMPLATE_SETTINGS.accentColor)
}

// CSS font stacks for the three brand typography choices, used by the live
// preview and the on-screen invoice. (The PDF maps these to its built-in fonts.)
export const FONT_FAMILY_STACKS: Record<InvoiceFontFamily, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
}

export function resolveFontStack(fontFamily: string | null | undefined): string {
  if (fontFamily === 'serif' || fontFamily === 'mono') return FONT_FAMILY_STACKS[fontFamily]
  return FONT_FAMILY_STACKS.sans
}

/**
 * Resolves the template settings for a single invoice: prefer the per-invoice
 * template persisted in `metadata.template` (Step 5b), and otherwise fall back
 * to the provided default (typically the user's global localStorage template).
 */
export function resolveInvoiceTemplate(
  metadata: unknown,
  fallback: InvoiceTemplateSettings = DEFAULT_INVOICE_TEMPLATE_SETTINGS,
): InvoiceTemplateSettings {
  if (metadata && typeof metadata === 'object') {
    const template = (metadata as Record<string, unknown>).template
    if (template && typeof template === 'object') {
      return sanitizeInvoiceTemplateSettings(template)
    }
  }
  return fallback
}

export function sanitizeInvoiceTemplateSettings(input: unknown): InvoiceTemplateSettings {
  if (!input || typeof input !== 'object') {
    return DEFAULT_INVOICE_TEMPLATE_SETTINGS
  }

  const settings = input as Partial<InvoiceTemplateSettings>
  const fields = settings.fields as Partial<InvoiceFieldVisibility> | undefined

  return {
    template: settings.template === 'modern' || settings.template === 'minimal' ? settings.template : 'classic',
    accentColor: sanitizeAccentColor(settings.accentColor),
    logoDataUrl: typeof settings.logoDataUrl === 'string' ? settings.logoDataUrl : '',
    fields: {
      showBusinessDetails: typeof fields?.showBusinessDetails === 'boolean' ? fields.showBusinessDetails : true,
      showClientDetails: typeof fields?.showClientDetails === 'boolean' ? fields.showClientDetails : true,
      showDueDate: typeof fields?.showDueDate === 'boolean' ? fields.showDueDate : true,
      showNotes: typeof fields?.showNotes === 'boolean' ? fields.showNotes : true,
      showStatusBadge: typeof fields?.showStatusBadge === 'boolean' ? fields.showStatusBadge : true,
    },
    branding: sanitizeInvoiceBranding(settings.branding),
    signature: sanitizeInvoiceSignature(settings.signature),
  }
}

export function sanitizeInvoiceBranding(input: unknown): InvoiceBrandingSettings {
  const b = (input && typeof input === 'object' ? input : {}) as Partial<InvoiceBrandingSettings>
  return {
    fontFamily: b.fontFamily === 'serif' || b.fontFamily === 'mono' ? b.fontFamily : 'sans',
    secondaryColor: sanitizeHexColor(b.secondaryColor, DEFAULT_INVOICE_BRANDING_SETTINGS.secondaryColor),
    watermarkText: typeof b.watermarkText === 'string' ? b.watermarkText.slice(0, 40) : '',
  }
}

export function sanitizeInvoiceSignature(input: unknown): InvoiceSignatureSettings {
  const s = (input && typeof input === 'object' ? input : {}) as Partial<InvoiceSignatureSettings>
  return {
    showSignature: typeof s.showSignature === 'boolean' ? s.showSignature : false,
    signatureName: typeof s.signatureName === 'string' ? s.signatureName.slice(0, 80) : '',
    signatureDataUrl: typeof s.signatureDataUrl === 'string' ? s.signatureDataUrl : '',
    showSeal: typeof s.showSeal === 'boolean' ? s.showSeal : false,
  }
}