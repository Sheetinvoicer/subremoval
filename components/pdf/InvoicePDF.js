import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

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

export default function InvoicePDF({ invoice, business }) {
  const currency = invoice.currency || 'USD';
  
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
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.subtitle}>#{invoice.invoice_number}</Text>
        </View>

        {/* Business Info */}
        {business && (
          <View style={styles.section}>
            <Text style={{ fontWeight: 'bold' }}>{business.business_name || 'Your Business'}</Text>
            <Text>{business.email || ''}</Text>
            <Text>{business.phone || ''}</Text>
          </View>
        )}

        {/* Status */}
        <View style={{ ...styles.statusBadge, backgroundColor: getStatusColor(invoice.status) }}>
          <Text style={styles.statusText}>{invoice.status?.toUpperCase() || 'DRAFT'}</Text>
        </View>

        {/* Client Info */}
        <View style={styles.clientBox}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Bill To:</Text>
          <Text>{invoice.clients?.name}</Text>
          <Text>{invoice.clients?.email}</Text>
          {invoice.clients?.address && <Text>{invoice.clients?.address}</Text>}
        </View>

        {/* Invoice Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
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
        <View style={styles.row}>
          <Text>Due Date:</Text>
          <Text>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</Text>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text>Payment due by {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'due date'}</Text>
        </View>
      </Page>
    </Document>
  );
}
