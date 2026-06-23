'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FormPageSkeleton } from '@/components/LoadingSkeleton';

interface ExpenseFormData {
  id: string;
  category: string;
  amount: string;
  currency: string;
  description: string;
  date: string;
}

const categories = [
  'Office Supplies',
  'Software',
  'Travel',
  'Food',
  'Utilities',
  'Rent',
  'Marketing',
  'Other',
];

function validateExpense(form: ExpenseFormData) {
  if (!form.category.trim()) return 'Category is required.';
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than 0.';
  if (!form.currency.trim() || form.currency.trim().length !== 3) return 'Currency must be a 3-letter code.';
  if (!form.date) return 'Date is required.';
  return null;
}

export default function EditExpensePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormData | null>(null);

  useEffect(() => {
    const loadExpense = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError('Failed to initialize Supabase client.');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError('Please log in to edit this expense.');
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('expenses')
        .select('id, category, amount, currency, description, date')
        .eq('user_id', user.id)
        .eq('id', id)
        .single();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setForm({
        id: data.id,
        category: data.category,
        amount: String(data.amount),
        currency: data.currency,
        description: data.description || '',
        date: data.date,
      });
      setLoading(false);
    };

    if (id) {
      loadExpense();
    }
  }, [id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    setError(null);
    const validationError = validateExpense(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Failed to initialize Supabase client.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setError('You must be logged in to update expenses.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from('expenses')
      .update({
        category: form.category.trim(),
        amount: Number(form.amount),
        currency: form.currency.trim().toUpperCase(),
        description: form.description.trim() || null,
        date: form.date,
      })
      .eq('id', form.id)
      .eq('user_id', user.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push(`/dashboard/expenses/${form.id}`);
  };

  if (loading) {
    return <FormPageSkeleton fields={5} />;
  }

  if (error && !form) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Expense</h1>
        <Link href={`/dashboard/expenses/${form.id}`} className="text-sm text-blue-600 hover:underline">
          Back to expense
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, category: e.target.value } : prev))}
            className="w-full border rounded px-3 py-2"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, amount: e.target.value } : prev))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <input
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, currency: e.target.value.toUpperCase() } : prev))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
            className="w-full border rounded px-3 py-2 min-h-24"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}