import {
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  sanitizeAccentColor,
  sanitizeInvoiceTemplateSettings,
} from '@/lib/invoiceTemplate';

describe('invoice template settings', () => {
  it('falls back to default accent color for invalid values', () => {
    expect(sanitizeAccentColor('#123456')).toBe('#123456');
    expect(sanitizeAccentColor('red')).toBe(DEFAULT_INVOICE_TEMPLATE_SETTINGS.accentColor);
    expect(sanitizeAccentColor('')).toBe(DEFAULT_INVOICE_TEMPLATE_SETTINGS.accentColor);
  });

  it('sanitizes unknown template settings input', () => {
    expect(sanitizeInvoiceTemplateSettings(null)).toEqual(DEFAULT_INVOICE_TEMPLATE_SETTINGS);
    expect(
      sanitizeInvoiceTemplateSettings({
        template: 'unknown',
        accentColor: '#12',
        fields: { showNotes: false },
      }),
    ).toEqual({
      ...DEFAULT_INVOICE_TEMPLATE_SETTINGS,
      fields: {
        ...DEFAULT_INVOICE_TEMPLATE_SETTINGS.fields,
        showNotes: false,
      },
    });
  });
});