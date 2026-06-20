export interface AccountingMapping {
  incomeAccount: string;
  taxType: string;
  trackingCategory: string;
  referencePrefix: string;
}

export interface AccountingInvoice {
  id: string;
  invoice_number: string;
  issue_date?: string | null;
  due_date?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total?: number | null;
  status?: string | null;
  clients?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export const DEFAULT_ACCOUNTING_MAPPING: AccountingMapping = {
  incomeAccount: 'Sales',
  taxType: 'TAX001',
  trackingCategory: 'General',
  referencePrefix: 'INV',
};

function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function resolveMapping(mapping?: Partial<AccountingMapping> | null): AccountingMapping {
  return {
    incomeAccount: mapping?.incomeAccount?.trim() || DEFAULT_ACCOUNTING_MAPPING.incomeAccount,
    taxType: mapping?.taxType?.trim() || DEFAULT_ACCOUNTING_MAPPING.taxType,
    trackingCategory: mapping?.trackingCategory?.trim() || DEFAULT_ACCOUNTING_MAPPING.trackingCategory,
    referencePrefix: mapping?.referencePrefix?.trim() || DEFAULT_ACCOUNTING_MAPPING.referencePrefix,
  };
}

export function buildQuickBooksRows(
  invoices: AccountingInvoice[],
  rawMapping?: Partial<AccountingMapping> | null,
): unknown[][] {
  const mapping = resolveMapping(rawMapping);
  return [
    ['TxnType', 'DocNumber', 'TxnDate', 'DueDate', 'Customer', 'Amount', 'TaxAmount', 'Currency', 'IncomeAccount', 'Memo'],
    ...invoices.map((invoice) => [
      'Invoice',
      invoice.invoice_number,
      invoice.issue_date ?? '',
      invoice.due_date ?? '',
      invoice.clients?.name ?? 'Unknown client',
      Number(invoice.subtotal ?? 0).toFixed(2),
      Number(invoice.tax_amount ?? 0).toFixed(2),
      invoice.currency ?? 'USD',
      mapping.incomeAccount,
      `${mapping.referencePrefix}-${invoice.invoice_number}`,
    ]),
  ];
}

export function buildXeroRows(
  invoices: AccountingInvoice[],
  rawMapping?: Partial<AccountingMapping> | null,
): unknown[][] {
  const mapping = resolveMapping(rawMapping);
  return [
    ['Type', 'ContactName', 'InvoiceNumber', 'Date', 'DueDate', 'LineAmount', 'TaxType', 'AccountCode', 'Currency', 'Reference', 'TrackingName'],
    ...invoices.map((invoice) => [
      'ACCREC',
      invoice.clients?.name ?? 'Unknown client',
      invoice.invoice_number,
      invoice.issue_date ?? '',
      invoice.due_date ?? '',
      Number(invoice.subtotal ?? 0).toFixed(2),
      mapping.taxType,
      mapping.incomeAccount,
      invoice.currency ?? 'USD',
      `${mapping.referencePrefix}-${invoice.invoice_number}`,
      mapping.trackingCategory,
    ]),
  ];
}

export function buildInvoiceExportRows(invoices: AccountingInvoice[]): unknown[][] {
  return [
    ['Invoice Number', 'Client', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax Amount', 'Total', 'Currency'],
    ...invoices.map((invoice) => [
      invoice.invoice_number,
      invoice.clients?.name ?? 'Unknown client',
      invoice.issue_date ?? '',
      invoice.due_date ?? '',
      invoice.status ?? '',
      Number(invoice.subtotal ?? 0).toFixed(2),
      Number(invoice.tax_amount ?? 0).toFixed(2),
      Number(invoice.total ?? 0).toFixed(2),
      invoice.currency ?? 'USD',
    ]),
  ];
}
