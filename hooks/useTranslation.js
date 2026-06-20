'use client'

import { useState, useEffect } from 'react'

const translations = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoices': 'Invoices',
    'nav.clients': 'Clients',
    'nav.expenses': 'Expenses',
    'nav.estimates': 'Estimates',
    'nav.recurring': 'Recurring',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.subscription': 'Subscription',
    'nav.logout': 'Logout',
    'nav.darkMode': 'Dark Mode',
    'nav.lightMode': 'Light Mode',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.loading': 'Loading...',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.export': 'Export CSV',
    
    // Invoices
    'invoices.title': 'Invoices',
    'invoices.new': 'New Invoice',
    'invoices.quick': 'Quick Invoice',
    'invoices.number': 'Invoice Number',
    'invoices.client': 'Client',
    'invoices.date': 'Date',
    'invoices.amount': 'Amount',
    'invoices.status': 'Status',
    'invoices.draft': 'Draft',
    'invoices.sent': 'Sent',
    'invoices.paid': 'Paid',
    'invoices.markAsSent': 'Mark as Sent',
    'invoices.markAsPaid': 'Mark as Paid',
    
    // Clients
    'clients.title': 'Clients',
    'clients.new': 'Add Client',
    'clients.name': 'Name',
    'clients.email': 'Email',
    'clients.phone': 'Phone',
    'clients.country': 'Country',
    'clients.state': 'State',
    'clients.currency': 'Currency',
    
    // Expenses
    'expenses.title': 'Expenses',
    'expenses.new': 'Add Expense',
    'expenses.category': 'Category',
    'expenses.description': 'Description',
    'expenses.amount': 'Amount',
    'expenses.date': 'Date',
    'expenses.taxDeductible': 'Tax Deductible',
    
    // Dashboard
    'dashboard.welcome': 'Welcome back',
    'dashboard.totalInvoices': 'Total Invoices',
    'dashboard.totalClients': 'Total Clients',
    'dashboard.totalRevenue': 'Total Revenue',
    'dashboard.pendingAmount': 'Pending Amount',
    'dashboard.recentInvoices': 'Recent Invoices',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.viewAll': 'View All',
  },
  es: {
    'nav.dashboard': 'Tablero',
    'nav.invoices': 'Facturas',
    'nav.clients': 'Clientes',
    'nav.expenses': 'Gastos',
    'nav.estimates': 'Presupuestos',
    'nav.recurring': 'Recurrentes',
    'nav.reports': 'Informes',
    'nav.settings': 'Configuración',
    'nav.subscription': 'Suscripción',
    'nav.logout': 'Cerrar sesión',
    'nav.darkMode': 'Modo oscuro',
    'nav.lightMode': 'Modo claro',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.loading': 'Cargando...',
    'common.back': 'Atrás',
    'common.confirm': 'Confirmar',
    'common.export': 'Exportar CSV',
    'invoices.title': 'Facturas',
    'invoices.new': 'Nueva factura',
    'invoices.quick': 'Factura rápida',
    'invoices.number': 'Número de factura',
    'invoices.client': 'Cliente',
    'invoices.date': 'Fecha',
    'invoices.amount': 'Monto',
    'invoices.status': 'Estado',
    'invoices.draft': 'Borrador',
    'invoices.sent': 'Enviada',
    'invoices.paid': 'Pagada',
    'clients.title': 'Clientes',
    'clients.new': 'Agregar cliente',
    'clients.name': 'Nombre',
    'clients.email': 'Correo',
    'dashboard.welcome': 'Bienvenido de nuevo',
    'dashboard.totalInvoices': 'Facturas totales',
    'dashboard.totalClients': 'Clientes totales',
    'dashboard.totalRevenue': 'Ingresos totales',
    'dashboard.pendingAmount': 'Monto pendiente',
    'dashboard.recentInvoices': 'Facturas recientes',
    'dashboard.viewAll': 'Ver todo',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.invoices': 'Factures',
    'nav.clients': 'Clients',
    'nav.expenses': 'Dépenses',
    'nav.estimates': 'Devis',
    'nav.recurring': 'Récurrentes',
    'nav.reports': 'Rapports',
    'nav.settings': 'Paramètres',
    'nav.subscription': 'Abonnement',
    'nav.logout': 'Déconnexion',
    'nav.darkMode': 'Mode sombre',
    'nav.lightMode': 'Mode clair',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.view': 'Voir',
    'common.loading': 'Chargement...',
    'common.back': 'Retour',
    'common.confirm': 'Confirmer',
    'common.export': 'Exporter CSV',
    'invoices.title': 'Factures',
    'invoices.new': 'Nouvelle facture',
    'invoices.quick': 'Facture rapide',
    'dashboard.welcome': 'Bon retour',
    'dashboard.totalInvoices': 'Factures totales',
    'dashboard.totalClients': 'Clients totaux',
    'dashboard.totalRevenue': 'Revenu total',
    'dashboard.pendingAmount': 'Montant en attente',
    'dashboard.recentInvoices': 'Factures récentes',
    'dashboard.viewAll': 'Voir tout',
  },
  ar: {
    'nav.dashboard': 'لوحة التحكم',
    'nav.invoices': 'الفواتير',
    'nav.clients': 'العملاء',
    'nav.expenses': 'المصروفات',
    'nav.estimates': 'تقديرات',
    'nav.recurring': 'متكرر',
    'nav.reports': 'تقارير',
    'nav.settings': 'الإعدادات',
    'nav.subscription': 'الاشتراك',
    'nav.logout': 'تسجيل الخروج',
    'nav.darkMode': 'الوضع الداكن',
    'nav.lightMode': 'الوضع المضيء',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.view': 'عرض',
    'common.loading': 'جاري التحميل...',
    'common.back': 'رجوع',
    'common.confirm': 'تأكيد',
    'common.export': 'تصدير CSV',
    'invoices.title': 'الفواتير',
    'invoices.new': 'فاتورة جديدة',
    'invoices.quick': 'فاتورة سريعة',
    'dashboard.welcome': 'مرحباً بعودتك',
    'dashboard.totalInvoices': 'إجمالي الفواتير',
    'dashboard.totalClients': 'إجمالي العملاء',
    'dashboard.totalRevenue': 'إجمالي الإيرادات',
    'dashboard.pendingAmount': 'المبلغ المعلق',
    'dashboard.recentInvoices': 'الفواتير الأخيرة',
    'dashboard.viewAll': 'عرض الكل',
  },
}

export function useTranslation() {
  const [locale, setLocale] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem('app-language')
    if (saved && translations[saved]) {
      setLocale(saved)
      // Set RTL for Arabic
      if (saved === 'ar') {
        document.documentElement.dir = 'rtl'
      } else {
        document.documentElement.dir = 'ltr'
      }
    }
  }, [])

  const t = (key) => {
    return translations[locale]?.[key] || translations.en[key] || key
  }

  return { t, locale }
}
