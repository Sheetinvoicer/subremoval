'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface FormState {
  invoice_number: string;
  client_name: string;
  amount: string;
  currency: string;
  frequency: string;
  next_date: string;
  status: string;
  notes: string;
}

const initialForm: FormState = {
  invoice_number: '',
  client_name: '',
  amount: '',
  currency: 'USD',
  frequency: 'monthly',
  next_date: new Date().toISOString().slice(0, 10),
  status: 'active',
  notes: '',
};

export default function NewRecurringPage() {
  const t = useTranslations('recurringPage');
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.client_name.trim()) return t('new.validation.clientRequired');
    const amount = parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) return t('new.validation.amountInvalid');
    if (!form.next_date) return t('new.validation.nextDateRequired');
    return null;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(t('errors.supabaseInit'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('new.errors.loginRequired'));
        return;
      }

      const payload = {
        user_id: authData.user.id,
        invoice_number: form.invoice_number.trim() || null,
        client_name: form.client_name.trim(),
        amount: parseFloat(form.amount),
        currency: form.currency.trim() || 'USD',
        frequency: form.frequency,
        next_date: form.next_date,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      const { error: insertError } = await supabase
        .from('recurring_invoices')
        .insert(payload);

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push('/dashboard/recurring');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('new.title')}</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div>
          <label htmlFor="invoice-number" className="block text-sm font-medium mb-1">{t('new.fields.invoiceNumber')}</label>
          <input id="invoice-number" name="invoice_number" value={form.invoice_number} onChange={(e) => updateField('invoice_number', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        </div>
        <div>
          <label htmlFor="client-name" className="block text-sm font-medium mb-1">{t('new.fields.clientName')}</label>
          <input id="client-name" name="client_name" value={form.client_name} onChange={(e) => updateField('client_name', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-1">{t('new.fields.amount')}</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => updateField('amount', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium mb-1">{t('new.fields.currency')}</label>
            <input id="currency" name="currency" value={form.currency} onChange={(e) => updateField('currency', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="frequency" className="block text-sm font-medium mb-1">{t('new.fields.frequency')}</label>
            <select id="frequency" name="frequency" value={form.frequency} onChange={(e) => updateField('frequency', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2">
              <option value="weekly">{t('frequency.weekly')}</option>
              <option value="biweekly">{t('frequency.biweekly')}</option>
              <option value="monthly">{t('frequency.monthly')}</option>
              <option value="quarterly">{t('frequency.quarterly')}</option>
              <option value="yearly">{t('frequency.yearly')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="next-date" className="block text-sm font-medium mb-1">{t('new.fields.nextDate')}</label>
            <input id="next-date" name="next_date" type="date" value={form.next_date} onChange={(e) => updateField('next_date', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">{t('new.fields.status')}</label>
          <select id="status" name="status" value={form.status} onChange={(e) => updateField('status', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2">
            <option value="active">{t('new.status.active')}</option>
            <option value="paused">{t('new.status.paused')}</option>
            <option value="cancelled">{t('new.status.cancelled')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">{t('new.fields.notes')}</label>
          <textarea id="notes" name="notes" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg disabled:opacity-60">
            {submitting ? t('new.actions.saving') : t('new.actions.create')}
          </button>
          <Link href="/dashboard/recurring" className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600">{t('new.actions.cancel')}</Link>
        </div>
      </form>
    </div>
  );
}
