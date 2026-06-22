const translations = {
  en: {
    'dashboard': 'Dashboard',
    'welcomeBack': 'Welcome back!',
    'revenue': 'Revenue',
    'netProfit': 'Net Profit',
    'pending': 'Pending',
    'totalInvoices': 'Total Invoices',
    'paid': 'Paid',
    'overdue': 'Overdue',
    'clients': 'Clients',
    'expenses': 'Expenses',
    'week': 'Week',
    'month': 'Month',
    'year': 'Year',
    'revenueTrend': 'Revenue Trend',
    'invoiceStatus': 'Invoice Status',
    'recentInvoices': 'Recent Invoices',
    'viewAll': 'View All',
    'due': 'Due',
    'na': 'N/A',
    'loading': 'Loading...',
    'noInvoices': 'No invoices found',
    'draft': 'Draft',
    'sent': 'Sent',
    'createFirstInvoice': 'Create your first invoice →',
    'createInvoice': 'Create Invoice',
    'darkMode': 'Dark Mode',
    'lightMode': 'Light Mode',
    'logout': 'Logout',
    'invoices': 'Invoices',
    'estimates': 'Estimates',
    'recurring': 'Recurring',
    'reports': 'Reports',
    'settings': 'Settings',
  },
  es: {
    'dashboard': 'Panel',
    'welcomeBack': '¡Bienvenido de nuevo!',
    'revenue': 'Ingresos',
    'netProfit': 'Beneficio Neto',
    'pending': 'Pendiente',
    'totalInvoices': 'Total Facturas',
    'paid': 'Pagado',
    'overdue': 'Vencido',
    'clients': 'Clientes',
    'expenses': 'Gastos',
    'week': 'Semana',
    'month': 'Mes',
    'year': 'Año',
    'revenueTrend': 'Tendencia de Ingresos',
    'invoiceStatus': 'Estado de Facturas',
    'recentInvoices': 'Facturas Recientes',
    'viewAll': 'Ver Todo',
    'due': 'Vence',
    'na': 'N/A',
    'loading': 'Cargando...',
    'noInvoices': 'No hay facturas',
    'draft': 'Borrador',
    'sent': 'Enviado',
    'createFirstInvoice': 'Crea tu primera factura →',
    'createInvoice': 'Crear Factura',
    'darkMode': 'Modo Oscuro',
    'lightMode': 'Modo Claro',
    'logout': 'Cerrar sesión',
    'invoices': 'Facturas',
    'estimates': 'Presupuestos',
    'recurring': 'Recurrente',
    'reports': 'Informes',
    'settings': 'Configuración',
  },
  ar: {
    'dashboard': 'لوحة التحكم',
    'welcomeBack': 'مرحبًا بعودتك!',
    'revenue': 'الإيرادات',
    'netProfit': 'صافي الربح',
    'pending': 'قيد الانتظار',
    'totalInvoices': 'إجمالي الفواتير',
    'paid': 'مدفوعة',
    'overdue': 'متأخرة',
    'clients': 'العملاء',
    'expenses': 'المصروفات',
    'week': 'أسبوع',
    'month': 'شهر',
    'year': 'سنة',
    'revenueTrend': 'اتجاه الإيرادات',
    'invoiceStatus': 'حالة الفواتير',
    'recentInvoices': 'أحدث الفواتير',
    'viewAll': 'عرض الكل',
    'due': 'الاستحقاق',
    'na': 'غير متاح',
    'loading': 'جارٍ التحميل...',
    'noInvoices': 'لا توجد فواتير',
    'draft': 'مسودة',
    'sent': 'مرسلة',
    'createFirstInvoice': 'أنشئ فاتورتك الأولى →',
    'createInvoice': 'إنشاء فاتورة',
    'darkMode': 'الوضع الداكن',
    'lightMode': 'الوضع الفاتح',
    'logout': 'تسجيل الخروج',
    'invoices': 'الفواتير',
    'estimates': 'عروض الأسعار',
    'recurring': 'المتكررة',
    'reports': 'التقارير',
    'settings': 'الإعدادات',
    'recurringInvoices': 'الفواتير المتكررة',
    'manageRecurring': 'إدارة الفوترة المتكررة',
    'newRecurring': 'فاتورة متكررة جديدة',
    'noRecurring': 'لا توجد فواتير متكررة',
    'createRecurring': 'إنشاء فاتورة متكررة',
    'invoice': 'فاتورة',
    'client': 'العميل',
    'amount': 'المبلغ',
    'frequency': 'التكرار',
    'nextDate': 'التاريخ القادم',
    'status': 'الحالة',
    'actions': 'الإجراءات',
    'currencySettings': 'إعدادات العملة',
    'setDefaultCurrency': 'تعيين العملة الافتراضية',
    'defaultCurrency': 'العملة الافتراضية',
    'preview': 'معاينة',
    'converterAmount': 'مبلغ التحويل',
    'usingFallbackRates': 'يتم استخدام أسعار بديلة حاليًا',
    'saving': 'جارٍ الحفظ...',
    'saveSettings': 'حفظ الإعدادات',
    'cancel': 'إلغاء',
  },
}

// This function reads localStorage on EVERY call
export function t(key) {
  let locale = 'en'
  if (typeof window !== 'undefined') {
    locale = localStorage.getItem('sheetinvoicer_locale') || localStorage.getItem('app-language') || 'en'
  }
  const value = translations[locale]?.[key] || translations.en[key]
  return value || key
}

export function getAvailableLanguages() {
  return [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  ]
}

export function setLanguage(locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('app-language', locale)
    window.location.reload()
  }
}

export function getCurrentLanguage() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('app-language') || 'en'
  }
  return 'en'
}