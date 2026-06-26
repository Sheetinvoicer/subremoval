import * as React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatCurrencyAmount } from '@/lib/currency'
import type { ExportInvoice, LocalizedExportLabels } from '@/lib/accountingExport'

export interface InvoiceListPdfProps {
  invoices: ExportInvoice[]
  locale: string
  /** Document heading (e.g. the localized "Invoices" title). */
  title: string
  labels: LocalizedExportLabels
  meta: { generatedAt: string; filterSummary: string }
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#111827', fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 8 },
  meta: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  table: { marginTop: 14, borderTopWidth: 1, borderColor: '#e5e7eb' },
  headRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 4 },
  cell: { paddingHorizontal: 4 },
  cellNumber: { width: '18%' },
  cellClient: { width: '30%' },
  cellStatus: { width: '16%' },
  cellTotal: { width: '18%', textAlign: 'right' },
  cellDue: { width: '18%' },
  headText: { fontFamily: 'Helvetica-Bold' },
})

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Deterministic, multi-invoice PDF for the filtered list export: a metadata
 * header (generated-at, filter summary, locale) followed by a table of every
 * filtered invoice. Pure function of its props so output is reproducible.
 */
export function InvoiceListPdf({ invoices, locale, title, labels, meta }: InvoiceListPdfProps) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{`${labels.generatedAt}: ${meta.generatedAt}`}</Text>
        <Text style={styles.meta}>{`${labels.filters}: ${meta.filterSummary}`}</Text>
        <Text style={styles.meta}>{`${labels.locale}: ${locale}`}</Text>

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.cell, styles.cellNumber, styles.headText]}>{labels.invoiceNumber}</Text>
            <Text style={[styles.cell, styles.cellClient, styles.headText]}>{labels.client}</Text>
            <Text style={[styles.cell, styles.cellStatus, styles.headText]}>{labels.status}</Text>
            <Text style={[styles.cell, styles.cellTotal, styles.headText]}>{labels.total}</Text>
            <Text style={[styles.cell, styles.cellDue, styles.headText]}>{labels.dueDate}</Text>
          </View>
          {invoices.map((invoice, index) => {
            const currency = invoice.currency || 'USD'
            return (
              <View key={invoice.id || `row-${index}`} style={styles.row} wrap={false}>
                <Text style={[styles.cell, styles.cellNumber]}>{invoice.invoice_number ?? ''}</Text>
                <Text style={[styles.cell, styles.cellClient]}>{invoice.client_name ?? ''}</Text>
                <Text style={[styles.cell, styles.cellStatus]}>{invoice.status ?? ''}</Text>
                <Text style={[styles.cell, styles.cellTotal]}>
                  {formatCurrencyAmount(Number(invoice.total ?? 0), currency, locale)}
                </Text>
                <Text style={[styles.cell, styles.cellDue]}>{formatDate(invoice.due_date, locale)}</Text>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}

/** Renders {@link InvoiceListPdf} to a Node Buffer (server-only, runtime=nodejs). */
export function renderInvoiceListPdf(props: InvoiceListPdfProps): Promise<Buffer> {
  return renderToBuffer(<InvoiceListPdf {...props} />)
}
