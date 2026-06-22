'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface Expense {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  currency: string;
  description?: string | null;
  date: string;
  created_at: string;
}

export default function ExpenseDetailPage() {
  const t = useTranslations('expensesPage.detail');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(null);

  useEffect(() => {
    const loadExpense = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError(t('errors.loginView'));
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', id)
        .single();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setExpense(data);
      setLoading(false);
    };

    if (id) {
      loadExpense();
    }
  }, [id]);

  const handleDelete = async () => {
    if (!expense) return;

    const supabase = createClient();
    if (!supabase) {
      setError(t('errors.supabaseInit'));
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setError(t('errors.loginDelete'));
      return;
    }

    setDeleting(true);
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)
      .eq('user_id', user.id);
    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    router.push('/dashboard/expenses');
  };

  if (loading) {
    return <div className="p-6">{t('loading')}</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-md bg-yellow-50 text-yellow-700 px-4 py-3 text-sm">{t('notFound')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <Link href="/dashboard/expenses" className="text-sm text-blue-600 hover:underline">
          {t('actions.backToExpenses')}
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500">{t('fields.category')}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{expense.category}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('fields.amount')}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {expense.currency} {Number(expense.amount).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('fields.date')}</p>
          <p className="text-gray-900 dark:text-white">{new Date(expense.date).toLocaleDateString()}</p>
        </div>
        {expense.description && (
          <div>
            <p className="text-sm text-gray-500">{t('fields.description')}</p>
            <p className="text-gray-900 dark:text-white">{expense.description}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Link href={`/dashboard/expenses/${expense.id}/edit`} className="px-4 py-2 rounded bg-blue-600 text-white">
            {t('actions.edit')}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
          >
            {deleting ? t('actions.deleting') : t('actions.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}