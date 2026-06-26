import { formatCurrencyAmount } from '@/lib/currency'

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
  // Prepend a UTF-8 BOM so spreadsheet apps (Excel) render accented
  // characters correctly, and use CRLF line endings for maximum import
  // compatibility with QuickBooks/Xero/Excel.
  const body = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  return `\uFEFF${body}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build a real Excel-openable document. Excel reliably opens an HTML table
// saved with a .xls extension and the application/vnd.ms-excel MIME type,
// without the "file format and extension don't match" warning that a CSV
// renamed to .xls produces. This avoids adding a spreadsheet library.
export function toExcelHtml(rows: unknown[][]): string {
  const [header, ...rest] = rows;
  const headerHtml = header
    ? `<thead><tr>${header
        .map((cell) => `<th>${escapeHtml(cell)}</th>`)
        .join('')}</tr></thead>`
    : '';
  const bodyHtml = `<tbody>${rest
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody>`;
  return (
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8" />' +
    '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>' +
    '<x:ExcelWorksheet><x:Name>Invoices</x:Name>' +
    '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>' +
    '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
    '</head><body>' +
    `<table border="1">${headerHtml}${bodyHtml}</table>` +
    '</body></html>'
  );
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
  // Columns follow the QuickBooks Online invoice import template, where each
  // invoice is a single line item (subtotal -> ItemAmount, tax tracked
  // separately). The income account maps to the Product/Service line account.
  return [
    [
      'InvoiceNo',
      'Customer',
      'InvoiceDate',
      'DueDate',
      'Item(Product/Service)',
      'ItemDescription',
      'ItemQuantity',
      'ItemRate',
      'ItemAmount',
      'ItemTaxAmount',
      'Currency',
      'Memo',
    ],
    ...invoices.map((invoice) => {
      const amount = Number(invoice.subtotal ?? 0);
      return [
        invoice.invoice_number,
        invoice.clients?.name ?? 'Unknown client',
        invoice.issue_date ?? '',
        invoice.due_date ?? '',
        mapping.incomeAccount,
        `${mapping.referencePrefix}-${invoice.invoice_number}`,
        '1',
        amount.toFixed(2),
        amount.toFixed(2),
        Number(invoice.tax_amount ?? 0).toFixed(2),
        invoice.currency ?? 'USD',
        `${mapping.referencePrefix}-${invoice.invoice_number}`,
      ];
    }),
  ];
}

export function buildXeroRows(
  invoices: AccountingInvoice[],
  rawMapping?: Partial<AccountingMapping> | null,
): unknown[][] {
  const mapping = resolveMapping(rawMapping);
  // Columns follow Xero's sales invoice import template. Xero requires
  // Description, Quantity and UnitAmount per line; each invoice is exported as
  // a single line whose UnitAmount equals the invoice subtotal.
  return [
    [
      'ContactName',
      'InvoiceNumber',
      'InvoiceDate',
      'DueDate',
      'Description',
      'Quantity',
      'UnitAmount',
      'AccountCode',
      'TaxType',
      'TaxAmount',
      'Currency',
      'Reference',
      'TrackingName1',
      'TrackingOption1',
    ],
    ...invoices.map((invoice) => [
      invoice.clients?.name ?? 'Unknown client',
      invoice.invoice_number,
      invoice.issue_date ?? '',
      invoice.due_date ?? '',
      `${mapping.referencePrefix}-${invoice.invoice_number}`,
      '1',
      Number(invoice.subtotal ?? 0).toFixed(2),
      mapping.incomeAccount,
      mapping.taxType,
      Number(invoice.tax_amount ?? 0).toFixed(2),
      invoice.currency ?? 'USD',
      `${mapping.referencePrefix}-${invoice.invoice_number}`,
      'TrackingCategory',
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

// Row shape produced by `buildInvoiceExportQuery` (INVOICE_EXPORT_COLUMNS): the
// client/project names are the denormalized columns, not an embedded relation.
export interface ExportInvoice {
  id?: string | null;
  invoice_number?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  status?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total?: number | null;
  due_date?: string | null;
  created_at?: string | null;
  notes?: string | null;
  tags?: string[] | null;
}

export interface LocalizedExportLabels {
  invoiceNumber: string;
  client: string;
  project: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  dueDate: string;
  createdAt: string;
  // Metadata row labels, prepended above the table.
  generatedAt: string;
  filters: string;
  locale: string;
}

export interface LocalizedExportOptions {
  locale: string;
  labels: LocalizedExportLabels;
  meta: { generatedAt: string; filterSummary: string; locale: string };
}

function formatExportDate(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

// Builds a locale-aware, deterministic row matrix for the filtered invoice
// export: a few prepended metadata rows (generated-at, filter summary, locale),
// a blank separator, the localized header, then one row per invoice with
// locale-formatted money (Intl.NumberFormat) and dates (Intl.DateTimeFormat).
export function buildLocalizedInvoiceExportRows(
  invoices: ExportInvoice[],
  opts: LocalizedExportOptions,
): unknown[][] {
  const { locale, labels, meta } = opts;
  const header = [
    labels.invoiceNumber,
    labels.client,
    labels.project,
    labels.status,
    labels.subtotal,
    labels.tax,
    labels.total,
    labels.currency,
    labels.dueDate,
    labels.createdAt,
  ];
  const body = invoices.map((invoice) => {
    const currency = invoice.currency || 'USD';
    return [
      invoice.invoice_number ?? '',
      invoice.client_name ?? '',
      invoice.project_name ?? '',
      invoice.status ?? '',
      formatCurrencyAmount(Number(invoice.subtotal ?? 0), currency, locale),
      formatCurrencyAmount(Number(invoice.tax_amount ?? 0), currency, locale),
      formatCurrencyAmount(Number(invoice.total ?? 0), currency, locale),
      currency,
      formatExportDate(invoice.due_date, locale),
      formatExportDate(invoice.created_at, locale),
    ];
  });
  return [
    [labels.generatedAt, meta.generatedAt],
    [labels.filters, meta.filterSummary],
    [labels.locale, meta.locale],
    [],
    header,
    ...body,
  ];
}
