'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface RecurringInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  amount: number;
  currency: string;
  frequency: string;
  next_date: string;
  status: string;
  created_at: string;
}

export default function RecurringPage() {
  const t = useTranslations('recurringPage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadRecurringInvoices();
  }, []);

  async function loadRecurringInvoices() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error(t('errors.supabaseInit'));
      }

      const { data, error: queryError } = await supabase
        .from('recurring_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (queryError) {
        throw new Error(queryError.message);
      }

      setRecurringInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      setRecurringInvoices([]);
      const errorMessage =
        err instanceof Error ? err.message : t('errors.loadFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    const key = `frequency.${frequency}` as const;
    try {
      return t(key as any);
    } catch {
      return frequency;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'paused':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const toggleStatus = async (invoice: RecurringInvoice) => {
    try {
      const supabase = createClient();
      const nextStatus = invoice.status === 'active' ? 'paused' : 'active';
      const { error: updateError } = await supabase
        .from('recurring_invoices')
        .update({ status: nextStatus })
        .eq('id', invoice.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setRecurringInvoices((prev) =>
        prev.map((item) => (item.id === invoice.id ? { ...item, status: nextStatus } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.updateFailed'));
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('id', id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setRecurringInvoices((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.deleteFailed'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t('errorPrefix')}: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/recurring/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {t('newRecurring')}
        </button>
      </div>

      {recurringInvoices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('empty.title')}
          </p>
          <button
            onClick={() => router.push('/dashboard/recurring/new')}
            className="text-blue-600 hover:underline"
          >
            {t('empty.cta')}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.invoice')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.client')}
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.frequency')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.nextDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recurringInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {invoice.client_name || t('unknownClient')}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {invoice.currency} {invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {getFrequencyLabel(invoice.frequency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(invoice.next_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleStatus(invoice)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm mr-3"
                      >
                        {invoice.status === 'active' ? t('actions.pause') : t('actions.resume')}
                      </button>
                      <button
                        onClick={() => deleteTemplate(invoice.id)}
                        className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
                      >
                        {t('actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
