import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import {
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  type InvoiceTemplateSettings,
  sanitizeAccentColor,
} from '@/lib/invoiceTemplate';

// Currency symbols for ALL 10 currencies
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  BRL: 'R$',
  AED: 'د.إ'
};

function formatCurrency(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  return `${symbol} ${Number(amount).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().split('T')[0];
}

// Register font
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/opensans/v18/mem8YaGs126MiZpBA-UFVZ0bf8pkAg6h6Rk.woff2' }
  ]
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica' },
  header: { marginBottom: 30, borderBottom: 1, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 5 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ccc' },
  totalAmount: { fontSize: 16, fontWeight: 'bold' },
  clientBox: { padding: 10, backgroundColor: '#f5f5f5', borderRadius: 5, marginBottom: 20 },
  statusBadge: { padding: 5, borderRadius: 5, alignSelf: 'flex-start', marginBottom: 10 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: 'white' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }
});

export default function InvoicePDF({ invoice, business, templateSettings = DEFAULT_INVOICE_TEMPLATE_SETTINGS }) {
  const currency = invoice.currency || 'USD';
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const normalizedSettings: InvoiceTemplateSettings = {
    ...DEFAULT_INVOICE_TEMPLATE_SETTINGS,
    ...templateSettings,
    fields: {
      ...DEFAULT_INVOICE_TEMPLATE_SETTINGS.fields,
      ...(templateSettings?.fields || {}),
    },
    accentColor: sanitizeAccentColor(templateSettings?.accentColor),
  }
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'paid': return '#10b981';
      case 'sent': return '#3b82f6';
      default: return '#f59e0b';
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={{ ...styles.header, borderBottomColor: normalizedSettings.accentColor }}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.subtitle}>#{invoice.invoice_number}</Text>
        </View>

        {normalizedSettings.logoDataUrl && (
          <View style={{ marginBottom: 16 }}>
            {/* @ts-ignore - Image support for react-pdf can vary by versions */}
            <Image src={normalizedSettings.logoDataUrl} style={{ width: 120, height: 40, objectFit: 'contain' }} />
          </View>
        )}

        {/* Business Info */}
        {business && normalizedSettings.fields.showBusinessDetails && (
          <View style={styles.section}>
            <Text style={{ fontWeight: 'bold' }}>{business.business_name || 'Your Business'}</Text>
            <Text>{business.email || ''}</Text>
            <Text>{business.phone || ''}</Text>
          </View>
        )}

        {/* Status */}
        {normalizedSettings.fields.showStatusBadge && (
          <View style={{ ...styles.statusBadge, backgroundColor: getStatusColor(invoice.status) }}>
            <Text style={styles.statusText}>{invoice.status?.toUpperCase() || 'DRAFT'}</Text>
          </View>
        )}

        {/* Client Info */}
        {normalizedSettings.fields.showClientDetails && (
          <View style={styles.clientBox}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Bill To:</Text>
            <Text>{invoice.clients?.name}</Text>
            <Text>{invoice.clients?.email}</Text>
            {invoice.clients?.address && <Text>{invoice.clients?.address}</Text>}
          </View>
        )}

        {/* Invoice Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>

          {items.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              {items.map((item, index) => {
                const quantity = Number(item.quantity || 0);
                const price = Number(item.price || 0);
                const lineTotal = quantity * price;

                return (
                  <View key={`${item.description || 'item'}-${index}`} style={styles.row}>
                    <Text>{item.description || 'Item'}</Text>
                    <Text>
                      {quantity} × {formatCurrency(price, currency)} = {formatCurrency(lineTotal, currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.row}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(invoice.subtotal || 0, currency)}</Text>
          </View>
          
          {invoice.discount_amount > 0 && (
            <View style={styles.row}>
              <Text>Discount ({invoice.discount_code}):</Text>
              <Text style={{ color: '#10b981' }}>-{formatCurrency(invoice.discount_amount, currency)}</Text>
            </View>
          )}
          
          {invoice.tax_amount > 0 && (
            <View style={styles.row}>
              <Text>Tax ({invoice.tax_rate_percentage}%):</Text>
              <Text>{formatCurrency(invoice.tax_amount, currency)}</Text>
            </View>
          )}
          
          <View style={styles.totalRow}>
            <Text style={{ fontWeight: 'bold' }}>Total:</Text>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.total, currency)}</Text>
          </View>
        </View>

        {/* Due Date */}
        {normalizedSettings.fields.showDueDate && (
          <View style={styles.row}>
            <Text>Due Date:</Text>
            <Text>{formatDate(invoice.due_date)}</Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && normalizedSettings.fields.showNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text>Payment due by {formatDate(invoice.due_date)}</Text>
        </View>
      </Page>
    </Document>
  );
}
