'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft } from 'lucide-react';

interface Expense {
  id: string;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  date: string;
}

interface PageProps {
  params: { id: string };
}

export default function EditExpensePage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadExpense() {
      try {
        const supabase = createClient();
        if (!supabase) {
          setError("Failed to initialize Supabase client");
          setLoading(false);
          return;
        }

        const { data, error: queryError } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', params.id)
          .single();

        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }

        setExpense(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load data";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    loadExpense();
  }, [params]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!expense) return;

    try {
      setSaving(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        setError("Failed to initialize Supabase client");
        return;
      }

      const { error: queryError } = await supabase
        .from('expenses')
        .update({
          category: expense.category,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description,
          date: expense.date,
        })
        .eq('id', expense.id);

      if (queryError) {
        setError(queryError.message);
        return;
      }

      router.push('/dashboard/expenses');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update expense';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-600 dark:text-yellow-400">Expense not found</p>
          <Link href="/dashboard/expenses">
            <a className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Back to Expenses
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/expenses">
          <a className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </a>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Expense</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
        {/* ...rest of the form */}
      </form>
    </div>
  );
}