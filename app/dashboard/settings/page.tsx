'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { routing, rtlLocales } from '@/i18n/routing';
import {
  DEFAULT_ACCOUNTING_MAPPING,
  type AccountingMapping,
  resolveMapping,
} from '@/lib/accountingExport';
import {
  DEFAULT_INVOICE_TEMPLATE_SETTINGS,
  INVOICE_TEMPLATE_STORAGE_KEY,
  type InvoiceTemplateId,
  type InvoiceTemplateSettings,
  sanitizeAccentColor,
  sanitizeInvoiceTemplateSettings,
} from '@/lib/invoiceTemplate';

const ACCOUNTING_MAPPING_STORAGE_KEY = 'sheetinvoicer_accounting_mapping';

interface UserSettings {
  default_currency: string;
  language: string;
  theme: string;
  notifications_enabled: boolean;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  default_currency: 'USD',
  language: 'en',
  theme: 'system',
  notifications_enabled: true,
  company_name: '',
  company_email: '',
  company_phone: '',
  company_address: '',
};

export default function SettingsPage() {
  const t = useTranslations('settings');
  const languageLabels: Record<string, string> = {
    en: t('languageOptions.en'),
    es: t('languageOptions.es'),
    fr: t('languageOptions.fr'),
    de: t('languageOptions.de'),
    it: t('languageOptions.it'),
    pt: t('languageOptions.pt'),
    tr: t('languageOptions.tr'),
    ar: t('languageOptions.ar'),
  };
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingAccounting, setExportingAccounting] = useState<null | 'quickbooks' | 'xero' | 'csv' | 'excel'>(null);
  const [cookieConsent, setCookieConsent] = useState<'accepted' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [invoiceTemplateSettings, setInvoiceTemplateSettings] =
    useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_TEMPLATE_SETTINGS);
  const [accountingMapping, setAccountingMapping] =
    useState<AccountingMapping>(DEFAULT_ACCOUNTING_MAPPING);
  const templateSettingsLoadedRef = useRef(false);
  const accountingMappingLoadedRef = useRef(false);

  // ORIGINAL useEffect - unchanged
  useEffect(() => {
    loadSettings();
    if (typeof document !== 'undefined') {
      const consentCookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith('cookie_consent='));
      const value = consentCookie?.split('=')[1];
      if (value === 'accepted' || value === 'rejected') {
        setCookieConsent(value);
      }
    }

    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(INVOICE_TEMPLATE_STORAGE_KEY);
      if (raw) {
        try {
          setInvoiceTemplateSettings(sanitizeInvoiceTemplateSettings(JSON.parse(raw)));
        } catch {
          setInvoiceTemplateSettings(DEFAULT_INVOICE_TEMPLATE_SETTINGS);
        }
      }

      const rawAccountingMapping = window.localStorage.getItem(ACCOUNTING_MAPPING_STORAGE_KEY);
      if (rawAccountingMapping) {
        try {
          setAccountingMapping(resolveMapping(JSON.parse(rawAccountingMapping)));
        } catch {
          setAccountingMapping(DEFAULT_ACCOUNTING_MAPPING);
        }
      }

      templateSettingsLoadedRef.current = true;
      accountingMappingLoadedRef.current = true;
    }
  }, []);

  // FIX 3: NEW useEffect - Auto-save template settings when they change
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      templateSettingsLoadedRef.current &&
      invoiceTemplateSettings
    ) {
      saveTemplateSettings(false);
    }
  }, [invoiceTemplateSettings]);

  // FIX 4: NEW useEffect - Auto-save accounting mapping when it changes
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      accountingMappingLoadedRef.current &&
      accountingMapping
    ) {
      saveAccountingMapping(false);
    }
  }, [accountingMapping]);

  async function persistLocale(nextLocale: string, shouldRefresh = true) {
    if (!routing.locales.includes(nextLocale as (typeof routing.locales)[number])) {
      return;
    }

    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: nextLocale }),
    });

    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = rtlLocales.has(nextLocale) ? 'rtl' : 'ltr';
    }

    if (shouldRefresh) {
      router.refresh();
    }
  }

  async function loadSettings() {
    try {
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userError || !user) {
        setError(t('errors.userNotAuthenticated'));
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (queryError && queryError.code !== 'PGRST116') {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setSettings({
          default_currency: data.default_currency || DEFAULT_SETTINGS.default_currency,
          language: data.language || DEFAULT_SETTINGS.language,
          theme: data.theme || DEFAULT_SETTINGS.theme,
          notifications_enabled:
            typeof data.notifications_enabled === 'boolean'
              ? data.notifications_enabled
              : DEFAULT_SETTINGS.notifications_enabled,
          company_name: data.company_name || '',
          company_email: data.company_email || '',
          company_phone: data.company_phone || '',
          company_address: data.company_address || '',
        });

        if (data.language && data.language !== locale) {
          await persistLocale(data.language, false);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedLoadSettings');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setSaving(true);
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userError || !user) {
        setError(t('errors.userNotAuthenticated'));
        return;
      }

      const { error: upsertError } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            ...settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      await persistLocale(settings.language);
      setSuccess(t('messages.saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedSaveSettings');
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateTemplateField<K extends keyof InvoiceTemplateSettings>(
    key: K,
    value: InvoiceTemplateSettings[K],
  ) {
    setInvoiceTemplateSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateTemplateVisibility(
    key: keyof InvoiceTemplateSettings['fields'],
    value: boolean,
  ) {
    setInvoiceTemplateSettings((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: value,
      },
    }));
  }

  // FIX 5: UPDATED function - Now shows success message
  function saveTemplateSettings(showToast = true) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      INVOICE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        ...invoiceTemplateSettings,
        accentColor: sanitizeAccentColor(invoiceTemplateSettings.accentColor),
      }),
    );
    if (showToast) {
      setSuccess(t('messages.templateSaved'));
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  function updateAccountingMapping<K extends keyof AccountingMapping>(
    key: K,
    value: AccountingMapping[K],
  ) {
    setAccountingMapping((prev) => ({ ...prev, [key]: value }));
  }

  // ORIGINAL function - unchanged (already had success message)
  function saveAccountingMapping(showToast = true) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      ACCOUNTING_MAPPING_STORAGE_KEY,
      JSON.stringify(resolveMapping(accountingMapping)),
    );
    if (showToast) {
      setSuccess(t('messages.accountingMappingSaved'));
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('errors.logoImageOnly'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const logoDataUrl = typeof reader.result === 'string' ? reader.result : '';
      updateTemplateField('logoDataUrl', logoDataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function exportMyData() {
    setError(null);
    setSuccess(null);
    setExportingData(true);

    try {
      const response = await fetch('/api/gdpr/export', {
        method: 'GET',
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || t('errors.failedExportData'));
        return;
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sheetinvoicer-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setSuccess(t('messages.dataExportReady'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedExportData');
      setError(errorMessage);
    } finally {
      setExportingData(false);
    }
  }

  async function exportAccounting(format: 'quickbooks' | 'xero' | 'csv' | 'excel') {
    setError(null);
    setSuccess(null);
    setExportingAccounting(format);

    try {
      const response = await fetch('/api/accounting/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          mapping: resolveMapping(accountingMapping),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || t('errors.failedExportAccountingData'));
        return;
      }

      const blob = await response.blob();
      const extension = format === 'excel' ? 'xls' : 'csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${format}-invoices.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setSuccess(t('messages.accountingExportReady', { format: format.toUpperCase() }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedExportAccountingData');
      setError(errorMessage);
    } finally {
      setExportingAccounting(null);
    }
  }

  async function deleteMyAccount() {
    const confirmed = window.confirm(
      t('privacy.deleteConfirm')
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingAccount(true);

    try {
      const response = await fetch('/api/gdpr/delete', {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || t('errors.failedDeleteAccountData'));
        return;
      }

      setSuccess(t('messages.accountDeleted'));
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedDeleteAccountData');
      setError(errorMessage);
    } finally {
      setDeletingAccount(false);
    }
  }

  function updateCookieConsent(value: 'accepted' | 'rejected') {
    document.cookie = `cookie_consent=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    localStorage.setItem('cookieConsent', value);
    setCookieConsent(value);
    window.dispatchEvent(new Event('cookie-consent-updated'));
    setSuccess(t(value === 'accepted' ? 'messages.cookiesEnabled' : 'messages.cookiesDisabled'));
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      <form onSubmit={saveSettings} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="settings-default-currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('fields.defaultCurrency')}</label>
            <select
              id="settings-default-currency"
              name="default_currency"
              value={settings.default_currency}
              onChange={(e) => updateField('default_currency', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>

          <div>
            <label htmlFor="settings-language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('language.label')}</label>
            <select
              id="settings-language"
              name="language"
              value={settings.language}
              onChange={(e) => updateField('language', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            >
              {routing.locales.map((value) => (
                <option key={value} value={value}>
                  {languageLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="settings-theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('fields.theme')}</label>
            <select
              id="settings-theme"
              name="theme"
              value={settings.theme}
              onChange={(e) => updateField('theme', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            >
              <option value="system">{t('themeOptions.system')}</option>
              <option value="light">{t('themeOptions.light')}</option>
              <option value="dark">{t('themeOptions.dark')}</option>
            </select>
          </div>

          <div className="flex items-center gap-3 md:pt-8">
            <input
              id="notifications_enabled"
              name="notifications_enabled"
              type="checkbox"
              checked={settings.notifications_enabled}
              onChange={(e) => updateField('notifications_enabled', e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
            <label htmlFor="notifications_enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fields.enableNotifications')}
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('company.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-company-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('company.nameLabel')}</label>
              <input
                id="settings-company-name"
                name="company_name"
                type="text"
                placeholder={t('company.namePlaceholder')}
                value={settings.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
              />
            </div>
            <div>
              <label htmlFor="settings-company-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('company.emailLabel')}</label>
              <input
                id="settings-company-email"
                name="company_email"
                type="email"
                placeholder={t('company.emailPlaceholder')}
                value={settings.company_email}
                onChange={(e) => updateField('company_email', e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
              />
            </div>
            <div>
              <label htmlFor="settings-company-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('company.phoneLabel')}</label>
              <input
                id="settings-company-phone"
                name="company_phone"
                type="text"
                placeholder={t('company.phonePlaceholder')}
                value={settings.company_phone}
                onChange={(e) => updateField('company_phone', e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
              />
            </div>
            <div>
              <label htmlFor="settings-company-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('company.addressLabel')}</label>
              <input
                id="settings-company-address"
                name="company_address"
                type="text"
                placeholder={t('company.addressPlaceholder')}
                value={settings.company_address}
                onChange={(e) => updateField('company_address', e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('template.title')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="template-selection" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('template.templateLabel')}</label>
              <select
                id="template-selection"
                name="template"
                value={invoiceTemplateSettings.template}
                onChange={(e) => updateTemplateField('template', e.target.value as InvoiceTemplateId)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
              >
                <option value="classic">{t('template.templateOptions.classic')}</option>
                <option value="modern">{t('template.templateOptions.modern')}</option>
                <option value="minimal">{t('template.templateOptions.minimal')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="template-accent-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('template.accentColor')}</label>
              <input
                id="template-accent-color"
                name="accentColor"
                type="color"
                value={sanitizeAccentColor(invoiceTemplateSettings.accentColor)}
                onChange={(e) => updateTemplateField('accentColor', sanitizeAccentColor(e.target.value))}
                className="h-12 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1"
              />
            </div>
            <div>
              <label htmlFor="template-logo-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('template.logoUpload')}</label>
              <input
                id="template-logo-upload"
                name="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label htmlFor="template-show-business-details" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="template-show-business-details"
                name="showBusinessDetails"
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showBusinessDetails}
                onChange={(e) => updateTemplateVisibility('showBusinessDetails', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              {t('template.visibility.showBusinessDetails')}
            </label>
            <label htmlFor="template-show-client-details" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="template-show-client-details"
                name="showClientDetails"
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showClientDetails}
                onChange={(e) => updateTemplateVisibility('showClientDetails', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              {t('template.visibility.showClientDetails')}
            </label>
            <label htmlFor="template-show-due-date" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="template-show-due-date"
                name="showDueDate"
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showDueDate}
                onChange={(e) => updateTemplateVisibility('showDueDate', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              {t('template.visibility.showDueDate')}
            </label>
            <label htmlFor="template-show-notes" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="template-show-notes"
                name="showNotes"
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showNotes}
                onChange={(e) => updateTemplateVisibility('showNotes', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              {t('template.visibility.showNotes')}
            </label>
            <label htmlFor="template-show-status-badge" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="template-show-status-badge"
                name="showStatusBadge"
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showStatusBadge}
                onChange={(e) => updateTemplateVisibility('showStatusBadge', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              {t('template.visibility.showStatusBadge')}
            </label>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('template.previewTitle')}</h3>
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div
                className={`px-4 py-3 text-white ${invoiceTemplateSettings.template === 'minimal' ? 'text-sm' : 'text-base'}`}
                style={{ backgroundColor: sanitizeAccentColor(invoiceTemplateSettings.accentColor) }}
              >
                {t(`template.templateOptions.${invoiceTemplateSettings.template}`)} {t('template.invoiceLabel')}
              </div>
              <div className="p-4 space-y-3 text-sm text-gray-700">
                {invoiceTemplateSettings.logoDataUrl && (
                  <img
                    src={invoiceTemplateSettings.logoDataUrl}
                    alt={t('template.logoPreviewAlt')}
                    className="h-10 w-auto object-contain"
                  />
                )}
                {invoiceTemplateSettings.fields.showBusinessDetails && <p>{t('template.previewBusiness')}</p>}
                {invoiceTemplateSettings.fields.showClientDetails && <p>{t('template.previewClient')}</p>}
                {invoiceTemplateSettings.fields.showDueDate && <p>{t('template.previewDueDate')}</p>}
                {invoiceTemplateSettings.fields.showStatusBadge && (
                  <span
                    className="inline-flex px-2 py-1 text-xs text-white rounded-full"
                    style={{ backgroundColor: sanitizeAccentColor(invoiceTemplateSettings.accentColor) }}
                  >
                    {t('template.previewStatus')}
                  </span>
                )}
                {invoiceTemplateSettings.fields.showNotes && <p>{t('template.previewNotes')}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveTemplateSettings()}
              className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
            >
              {t('template.saveButton')}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? t('actions.saving') : t('actions.saveSettings')}
          </button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('accounting.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('accounting.subtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="accounting-income-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounting.incomeAccount')}</label>
              <input
                id="accounting-income-account"
                name="incomeAccount"
                type="text"
                value={accountingMapping.incomeAccount}
                onChange={(e) => updateAccountingMapping('incomeAccount', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder={t('accounting.placeholders.incomeAccount')}
              />
            </div>
            <div>
              <label htmlFor="accounting-tax-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounting.taxType')}</label>
              <input
                id="accounting-tax-type"
                name="taxType"
                type="text"
                value={accountingMapping.taxType}
                onChange={(e) => updateAccountingMapping('taxType', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder={t('accounting.placeholders.taxType')}
              />
            </div>
            <div>
              <label htmlFor="accounting-tracking-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounting.trackingCategory')}</label>
              <input
                id="accounting-tracking-category"
                name="trackingCategory"
                type="text"
                value={accountingMapping.trackingCategory}
                onChange={(e) => updateAccountingMapping('trackingCategory', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder={t('accounting.placeholders.trackingCategory')}
              />
            </div>
            <div>
              <label htmlFor="accounting-reference-prefix" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounting.referencePrefix')}</label>
              <input
                id="accounting-reference-prefix"
                name="referencePrefix"
                type="text"
                value={accountingMapping.referencePrefix}
                onChange={(e) => updateAccountingMapping('referencePrefix', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder={t('accounting.placeholders.referencePrefix')}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveAccountingMapping()}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
            >
              {t('accounting.saveMapping')}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('quickbooks')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {exportingAccounting === 'quickbooks' ? t('actions.preparing') : t('accounting.exportQuickBooks')}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('xero')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {exportingAccounting === 'xero' ? t('actions.preparing') : t('accounting.exportXero')}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('csv')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {exportingAccounting === 'csv' ? t('actions.preparing') : t('accounting.exportCsv')}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('excel')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
            >
              {exportingAccounting === 'excel' ? t('actions.preparing') : t('accounting.exportExcel')}
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('privacy.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('privacy.subtitle')}
          </p>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('privacy.cookieConsent')} {cookieConsent ? t(`privacy.cookieState.${cookieConsent}`) : t('privacy.cookieState.notSet')}
              </span>
              <button
                type="button"
                onClick={() => updateCookieConsent('accepted')}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                {t('privacy.acceptCookies')}
              </button>
              <button
                type="button"
                onClick={() => updateCookieConsent('rejected')}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                {t('privacy.rejectCookies')}
              </button>
            </div>

            <button
              type="button"
              onClick={exportMyData}
              disabled={exportingData}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              {exportingData ? t('actions.preparingExport') : t('privacy.exportData')}
            </button>

            <button
              type="button"
              onClick={deleteMyAccount}
              disabled={deletingAccount}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deletingAccount ? t('actions.deletingAccount') : t('privacy.deleteAccount')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
