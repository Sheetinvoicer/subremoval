import {
  buildInvoiceExportRows,
  buildQuickBooksRows,
  buildXeroRows,
  resolveMapping,
  toCsv,
} from '@/lib/accountingExport';

describe('accounting export helpers', () => {
  const invoices = [
    {
      id: 'inv-1',
      invoice_number: 'INV-1001',
      issue_date: '2026-06-01',
      due_date: '2026-06-15',
      currency: 'USD',
      subtotal: 100,
      tax_amount: 10,
      total: 110,
      status: 'sent',
      clients: { name: 'Acme Corp' },
    },
  ];

  it('builds quickbooks rows using mapping', () => {
    const rows = buildQuickBooksRows(invoices, { incomeAccount: '4000', referencePrefix: 'QB' });
    expect(rows[0]).toEqual(expect.arrayContaining(['TxnType', 'DocNumber', 'IncomeAccount']));
    expect(rows[1]).toEqual(expect.arrayContaining(['Invoice', 'INV-1001', '4000', 'QB-INV-1001']));
  });

  it('builds xero rows using defaults and explicit mapping', () => {
    const rows = buildXeroRows(invoices, { taxType: 'OUTPUT2', trackingCategory: 'Region-US' });
    expect(rows[0]).toEqual(expect.arrayContaining(['Type', 'TaxType', 'TrackingName']));
    expect(rows[1]).toEqual(expect.arrayContaining(['ACCREC', 'OUTPUT2', 'Region-US']));
  });

  it('builds generic invoice export rows and CSV output', () => {
    const csv = toCsv(buildInvoiceExportRows(invoices));
    expect(csv).toContain('"Invoice Number"');
    expect(csv).toContain('"INV-1001"');
    expect(csv).toContain('"110.00"');
  });

  it('fills missing mapping values with defaults', () => {
    expect(resolveMapping({ incomeAccount: '' })).toEqual({
      incomeAccount: 'Sales',
      taxType: 'TAX001',
      trackingCategory: 'General',
      referencePrefix: 'INV',
    });
  });
});
