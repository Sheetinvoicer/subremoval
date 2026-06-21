'use client';
import React, { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
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
    }
  }, []);

  async function loadSettings() {
    try {
      const supabase = createClient();
      if (!supabase) {
        setError('Failed to initialize Supabase client');
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userError || !user) {
        setError('User not authenticated');
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
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
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
        setError('Failed to initialize Supabase client');
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userError || !user) {
        setError('User not authenticated');
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

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
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

  function saveTemplateSettings() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      INVOICE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        ...invoiceTemplateSettings,
        accentColor: sanitizeAccentColor(invoiceTemplateSettings.accentColor),
      }),
    );
  }

  function updateAccountingMapping<K extends keyof AccountingMapping>(
    key: K,
    value: AccountingMapping[K],
  ) {
    setAccountingMapping((prev) => ({ ...prev, [key]: value }));
  }

  function saveAccountingMapping() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      ACCOUNTING_MAPPING_STORAGE_KEY,
      JSON.stringify(resolveMapping(accountingMapping)),
    );
    setSuccess('Accounting mapping saved.');
    setTimeout(() => setSuccess(null), 3000);
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file for the invoice logo.');
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
        setError(payload.error || 'Failed to export data');
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

      setSuccess('Your data export is ready and has been downloaded.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export data';
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
        setError(payload.error || 'Failed to export accounting data');
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

      setSuccess(`${format.toUpperCase()} export is ready and has been downloaded.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export accounting data';
      setError(errorMessage);
    } finally {
      setExportingAccounting(null);
    }
  }

  async function deleteMyAccount() {
    const confirmed = window.confirm(
      'This action permanently deletes your account and all related data. This cannot be undone. Continue?'
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
        setError(payload.error || 'Failed to delete account data');
        return;
      }

      setSuccess('Your account and personal data were deleted successfully.');
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account data';
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
    setSuccess(`Cookie preferences updated: ${value === 'accepted' ? 'optional cookies enabled' : 'optional cookies disabled'}.`);
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
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your account preferences</p>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Currency</label>
            <select
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
            <select
              value={settings.language}
              onChange={(e) => updateField('language', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ar">Arabic</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => updateField('theme', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="flex items-center gap-3 md:pt-8">
            <input
              id="notifications_enabled"
              type="checkbox"
              checked={settings.notifications_enabled}
              onChange={(e) => updateField('notifications_enabled', e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
            <label htmlFor="notifications_enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Notifications
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Company Name"
              value={settings.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            />
            <input
              type="email"
              placeholder="Company Email"
              value={settings.company_email}
              onChange={(e) => updateField('company_email', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            />
            <input
              type="text"
              placeholder="Company Phone"
              value={settings.company_phone}
              onChange={(e) => updateField('company_phone', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            />
            <input
              type="text"
              placeholder="Company Address"
              value={settings.company_address}
              onChange={(e) => updateField('company_address', e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invoice Template Customization</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Template</label>
              <select
                value={invoiceTemplateSettings.template}
                onChange={(e) => updateTemplateField('template', e.target.value as InvoiceTemplateId)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
              >
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accent Color</label>
              <input
                type="color"
                value={sanitizeAccentColor(invoiceTemplateSettings.accentColor)}
                onChange={(e) => updateTemplateField('accentColor', sanitizeAccentColor(e.target.value))}
                className="h-12 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo Upload</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showBusinessDetails}
                onChange={(e) => updateTemplateVisibility('showBusinessDetails', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Show business details
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showClientDetails}
                onChange={(e) => updateTemplateVisibility('showClientDetails', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Show client details
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showDueDate}
                onChange={(e) => updateTemplateVisibility('showDueDate', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Show due date
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showNotes}
                onChange={(e) => updateTemplateVisibility('showNotes', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Show notes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={invoiceTemplateSettings.fields.showStatusBadge}
                onChange={(e) => updateTemplateVisibility('showStatusBadge', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Show status badge
            </label>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Template Preview</h3>
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div
                className={`px-4 py-3 text-white ${invoiceTemplateSettings.template === 'minimal' ? 'text-sm' : 'text-base'}`}
                style={{ backgroundColor: sanitizeAccentColor(invoiceTemplateSettings.accentColor) }}
              >
                {invoiceTemplateSettings.template.toUpperCase()} Invoice
              </div>
              <div className="p-4 space-y-3 text-sm text-gray-700">
                {invoiceTemplateSettings.logoDataUrl && (
                  <img
                    src={invoiceTemplateSettings.logoDataUrl}
                    alt="Invoice logo preview"
                    className="h-10 w-auto object-contain"
                  />
                )}
                {invoiceTemplateSettings.fields.showBusinessDetails && <p>Business: Acme Studio</p>}
                {invoiceTemplateSettings.fields.showClientDetails && <p>Client: Example Client</p>}
                {invoiceTemplateSettings.fields.showDueDate && <p>Due date: 2026-07-20</p>}
                {invoiceTemplateSettings.fields.showStatusBadge && (
                  <span
                    className="inline-flex px-2 py-1 text-xs text-white rounded-full"
                    style={{ backgroundColor: sanitizeAccentColor(invoiceTemplateSettings.accentColor) }}
                  >
                    SENT
                  </span>
                )}
                {invoiceTemplateSettings.fields.showNotes && <p>Notes: Thank you for your business.</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={saveTemplateSettings}
              className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
            >
              Save template customization
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bank & Accounting Integration</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Configure your accounting mapping and export invoices for QuickBooks, Xero, CSV, or Excel.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Income account</label>
              <input
                type="text"
                value={accountingMapping.incomeAccount}
                onChange={(e) => updateAccountingMapping('incomeAccount', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="Sales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax type</label>
              <input
                type="text"
                value={accountingMapping.taxType}
                onChange={(e) => updateAccountingMapping('taxType', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="TAX001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tracking category</label>
              <input
                type="text"
                value={accountingMapping.trackingCategory}
                onChange={(e) => updateAccountingMapping('trackingCategory', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="General"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference prefix</label>
              <input
                type="text"
                value={accountingMapping.referencePrefix}
                onChange={(e) => updateAccountingMapping('referencePrefix', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="INV"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveAccountingMapping}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
            >
              Save mapping
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('quickbooks')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {exportingAccounting === 'quickbooks' ? 'Preparing...' : 'Export QuickBooks (CSV)'}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('xero')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {exportingAccounting === 'xero' ? 'Preparing...' : 'Export Xero (CSV)'}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('csv')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {exportingAccounting === 'csv' ? 'Preparing...' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => exportAccounting('excel')}
              disabled={!!exportingAccounting}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
            >
              {exportingAccounting === 'excel' ? 'Preparing...' : 'Export Excel'}
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Privacy & GDPR</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Manage your cookie preference, export your personal data, or permanently delete your account.
          </p>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Cookie consent: {cookieConsent ? cookieConsent : 'not set'}
              </span>
              <button
                type="button"
                onClick={() => updateCookieConsent('accepted')}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Accept optional cookies
              </button>
              <button
                type="button"
                onClick={() => updateCookieConsent('rejected')}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                Reject optional cookies
              </button>
            </div>

            <button
              type="button"
              onClick={exportMyData}
              disabled={exportingData}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              {exportingData ? 'Preparing export...' : 'Export my data (JSON)'}
            </button>

            <button
              type="button"
              onClick={deleteMyAccount}
              disabled={deletingAccount}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deletingAccount ? 'Deleting account...' : 'Delete account and all data'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
