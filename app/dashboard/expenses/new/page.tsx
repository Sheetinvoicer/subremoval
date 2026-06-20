'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

interface ExpenseFormData {
  category: string;
  amount: string;
  currency: string;
  description: string;
  date: string;
}

function validateExpense(form: ExpenseFormData) {
  if (!form.category.trim()) return 'Category is required.';
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than 0.';
  if (!form.currency.trim() || form.currency.trim().length !== 3) return 'Currency must be a 3-letter code.';
  if (!form.date) return 'Date is required.';
  return null;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormData>({
    category: 'Office Supplies',
    amount: '',
    currency: 'USD',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      setError('You must be logged in to create expenses.');
      return;
    }

    setSubmitting(true);
    const { data, error: insertError } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        category: form.category.trim(),
        amount: Number(form.amount),
        currency: form.currency.trim().toUpperCase(),
        description: form.description.trim() || null,
        date: form.date,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(data?.id ? `/dashboard/expenses/${data.id}` : '/dashboard/expenses');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Expense</h1>
        <Link href="/dashboard/expenses" className="text-sm text-blue-600 hover:underline">
          Back to expenses
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        <div>
          <label htmlFor="expense-category" className="block text-sm font-medium mb-1">Category</label>
          <select
            id="expense-category"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
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
            <label htmlFor="expense-amount" className="block text-sm font-medium mb-1">Amount</label>
            <input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="expense-currency" className="block text-sm font-medium mb-1">Currency</label>
            <input
              id="expense-currency"
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="expense-date" className="block text-sm font-medium mb-1">Date</label>
          <input
            id="expense-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="expense-description" className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            id="expense-description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full border rounded px-3 py-2 min-h-24"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}