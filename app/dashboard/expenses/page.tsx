"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CardGridSkeleton } from '@/components/LoadingSkeleton';
import { useTranslations } from 'next-intl';

interface Expense {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  date: string;
  created_at: string;
}

export default function ExpensesPage() {
  const t = useTranslations('expensesPage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = createClient();
        if (!supabase) {
          setError(t('errors.supabaseInit'));
          setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          setError(authError?.message || t('errors.loginRequired'));
          setLoading(false);
          return;
        }

        const { data, error: queryError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', authData.user.id)
          .order('date', { ascending: false });

        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }

        setExpenses(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadExpenses();
  }, []);

  const total = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [expenses],
  );

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      'Office Supplies': '📎',
      'Software': '💻',
      'Travel': '✈️',
      'Food': '🍽️',
      'Utilities': '⚡',
      'Rent': '🏠',
      'Marketing': '📢',
      'Other': '📦',
    };
    return emojis[category] || '📦';
  };

  if (loading) {
    return <CardGridSkeleton withToolbar />;
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
            {t('actions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/expenses/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
          + {t('actions.addExpense')}
        </Link>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">{t('empty.title')}</p>
          <Link href="/dashboard/expenses/new" className="text-blue-600 hover:underline">
            {t('empty.cta')}
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('stats.totalExpenses')}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              ${total.toFixed(2)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl">{getCategoryEmoji(expense.category)}</div>
                  <Link href={`/dashboard/expenses/${expense.id}`} className="text-blue-600 dark:text-blue-400 text-sm">
                    {t('actions.view')} →
                  </Link>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {expense.category}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {expense.currency} {expense.amount.toFixed(2)}
                </p>
                {expense.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {expense.description}
                  </p>
                )}
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  {new Date(expense.date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}