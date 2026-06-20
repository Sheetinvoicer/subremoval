export type InvoiceTemplateId = 'classic' | 'modern' | 'minimal'

export interface InvoiceFieldVisibility {
  showBusinessDetails: boolean
  showClientDetails: boolean
  showDueDate: boolean
  showNotes: boolean
  showStatusBadge: boolean
}

export interface InvoiceTemplateSettings {
  template: InvoiceTemplateId
  accentColor: string
  logoDataUrl: string
  fields: InvoiceFieldVisibility
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
}

export const INVOICE_TEMPLATE_STORAGE_KEY = 'invoice_template_settings'

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/

export function sanitizeAccentColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_INVOICE_TEMPLATE_SETTINGS.accentColor
  return HEX_COLOR_REGEX.test(color) ? color : DEFAULT_INVOICE_TEMPLATE_SETTINGS.accentColor
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
  }
}