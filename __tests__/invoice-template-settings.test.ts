import {
  DEFAULT_INVOICE_BRANDING_SETTINGS,
  DEFAULT_INVOICE_SIGNATURE_SETTINGS,
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  resolveFontStack,
  resolveInvoiceTemplate,
  sanitizeAccentColor,
  sanitizeInvoiceBranding,
  sanitizeInvoiceSignature,
  sanitizeInvoiceTemplateSettings,
  type InvoiceTemplateSettings,
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

describe('resolveInvoiceTemplate', () => {
  const fallback: InvoiceTemplateSettings = {
    ...DEFAULT_INVOICE_TEMPLATE_SETTINGS,
    template: 'modern',
    accentColor: '#abcdef',
  };

  it('prefers a valid per-invoice template from metadata.template', () => {
    const resolved = resolveInvoiceTemplate({ template: { template: 'minimal', accentColor: '#111111' } }, fallback);
    expect(resolved.template).toBe('minimal');
    expect(resolved.accentColor).toBe('#111111');
  });

  it('falls back to the provided default when metadata has no template', () => {
    expect(resolveInvoiceTemplate({ taxMode: 'inclusive' }, fallback)).toEqual(fallback);
    expect(resolveInvoiceTemplate(null, fallback)).toEqual(fallback);
    expect(resolveInvoiceTemplate(undefined, fallback)).toEqual(fallback);
  });

  it('defaults to DEFAULT_INVOICE_TEMPLATE_SETTINGS when no fallback is given', () => {
    expect(resolveInvoiceTemplate(null)).toEqual(DEFAULT_INVOICE_TEMPLATE_SETTINGS);
  });
});

describe('branding + signature settings (Phase 6)', () => {
  it('backfills branding/signature defaults for legacy settings without them', () => {
    const sanitized = sanitizeInvoiceTemplateSettings({ template: 'modern', accentColor: '#abcdef' });
    expect(sanitized.branding).toEqual(DEFAULT_INVOICE_BRANDING_SETTINGS);
    expect(sanitized.signature).toEqual(DEFAULT_INVOICE_SIGNATURE_SETTINGS);
  });

  it('sanitizes branding: font fallback, hex validation and watermark cap', () => {
    const branding = sanitizeInvoiceBranding({
      fontFamily: 'comic',
      secondaryColor: 'not-a-color',
      watermarkText: 'x'.repeat(80),
    });
    expect(branding.fontFamily).toBe('sans');
    expect(branding.secondaryColor).toBe(DEFAULT_INVOICE_BRANDING_SETTINGS.secondaryColor);
    expect(branding.watermarkText).toHaveLength(40);
  });

  it('keeps valid branding values', () => {
    const branding = sanitizeInvoiceBranding({ fontFamily: 'serif', secondaryColor: '#0a0a0a', watermarkText: 'PAID' });
    expect(branding).toEqual({ fontFamily: 'serif', secondaryColor: '#0a0a0a', watermarkText: 'PAID' });
  });

  it('sanitizes signature: coerces booleans and caps the typed name', () => {
    const signature = sanitizeInvoiceSignature({
      showSignature: 'yes',
      signatureName: 'n'.repeat(120),
      signatureDataUrl: 'data:image/png;base64,AAAA',
      showSeal: true,
    });
    expect(signature.showSignature).toBe(false);
    expect(signature.showSeal).toBe(true);
    expect(signature.signatureName).toHaveLength(80);
    expect(signature.signatureDataUrl).toBe('data:image/png;base64,AAAA');
  });

  it('round-trips branding/signature through sanitizeInvoiceTemplateSettings', () => {
    const input = {
      template: 'minimal',
      branding: { fontFamily: 'mono', secondaryColor: '#123456', watermarkText: 'DRAFT' },
      signature: { showSignature: true, signatureName: 'Jane', signatureDataUrl: '', showSeal: true },
    };
    const out = sanitizeInvoiceTemplateSettings(input);
    expect(out.branding).toEqual({ fontFamily: 'mono', secondaryColor: '#123456', watermarkText: 'DRAFT' });
    expect(out.signature.showSignature).toBe(true);
    expect(out.signature.signatureName).toBe('Jane');
  });
});

describe('resolveFontStack', () => {
  it('maps known families and falls back to sans', () => {
    expect(resolveFontStack('serif')).toContain('serif');
    expect(resolveFontStack('mono')).toContain('monospace');
    expect(resolveFontStack('unknown')).toBe(resolveFontStack('sans'));
  });
});