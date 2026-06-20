import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30 },
  header: { fontSize: 20, marginBottom: 20, textAlign: 'center' },
  invoiceBlock: { marginBottom: 30, padding: 10, borderBottom: '1px solid #ccc' },
  title: { fontSize: 16, marginBottom: 10 },
  row: { flexDirection: 'row', marginBottom: 5 },
  label: { width: 100, fontSize: 10, fontWeight: 'bold' },
  value: { fontSize: 10, flex: 1 }
})

export default function MultiInvoicePDF({ invoices, business }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>All Invoices - {business?.name || 'Your Business'}</Text>
        {invoices.map((invoice) => (
          <View key={invoice.id} style={styles.invoiceBlock}>
            <Text style={styles.title}>Invoice #{invoice.invoice_number}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Client:</Text>
              <Text style={styles.value}>{invoice.clients?.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Amount:</Text>
              <Text style={styles.value}>${Number(invoice.total).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text style={styles.value}>{invoice.status}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Date:</Text>
              <Text style={styles.value}>{new Date(invoice.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  )
}
