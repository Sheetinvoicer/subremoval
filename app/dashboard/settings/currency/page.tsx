'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SettingsSkeleton } from '@/components/LoadingSkeleton';
import { t } from '@/lib/i18n';
import { convertAmount, formatCurrencyAmount, getRatesWithDailyCache } from '@/lib/currency';

interface CurrencySetting {
  id: string;
  default_currency: string;
  user_id: string;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
];

export default function CurrencySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [converterAmount, setConverterAmount] = useState(1000);
  const [currentSetting, setCurrentSetting] = useState<CurrencySetting | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadSettings();
    loadRates();
  }, []);

  async function loadRates() {
    try {
      const loadedRates = await getRatesWithDailyCache();
      setRates(loadedRates);
    } catch {
      setRates(null);
    }
  }

  async function loadSettings() {
    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Failed to initialize Supabase client");
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
        .from('user_currency_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (queryError && queryError.code !== 'PGRST116') {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setCurrentSetting(data);
        setSelectedCurrency(data.default_currency || 'USD');
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

      const { error: queryError } = await supabase
        .from('user_currency_settings')
        .upsert({
          user_id: user.id,
          default_currency: selectedCurrency,
          updated_at: new Date().toISOString(),
        });

      if (queryError) {
        setError(queryError.message);
        return;
      }

      setSuccess('Currency settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SettingsSkeleton sections={2} />;
  }

  const convertedPreviewAmount = rates
    ? convertAmount(converterAmount, 'USD', selectedCurrency, rates as any)
    : converterAmount;

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('currencySettings') || 'Currency Settings'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('setDefaultCurrency') || 'Set your default currency for invoices and estimates'}
        </p>
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

      <form onSubmit={saveSettings} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('defaultCurrency') || 'Default Currency'}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CURRENCIES.map((currency) => (
              <button
                key={currency.code}
                type="button"
                onClick={() => setSelectedCurrency(currency.code)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  selectedCurrency === currency.code
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-2xl">{currency.symbol}</div>
                <div className="text-sm font-medium mt-1">{currency.code}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {currency.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('preview') || 'Preview'}:</span>
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="converterAmount">
              {t('converterAmount') || 'Converter Amount (USD)'}
            </label>
            <input
              id="converterAmount"
              type="number"
              min="0"
              value={converterAmount}
              onChange={(event) => setConverterAmount(Number(event.target.value || 0))}
              className="w-full md:w-56 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {formatCurrencyAmount(converterAmount, 'USD')} = {formatCurrencyAmount(convertedPreviewAmount, selectedCurrency)}
            </p>
            {!rates && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('usingFallbackRates') || 'Using fallback conversion rates right now.'}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? t('saving') || 'Saving...' : t('saveSettings') || 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/settings')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('cancel') || 'Cancel'}
          </button>
        </div>
      </form>
    </div>
  );
}