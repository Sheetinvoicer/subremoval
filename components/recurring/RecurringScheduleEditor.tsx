'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

export interface RecurringInitialValue {
  invoice_number?: string | null;
  client_name?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  frequency?: string | null;
  next_date?: string | null;
  status?: string | null;
  notes?: string | null;
  exceptions?: unknown;
}

interface RecurringScheduleEditorProps {
  /** Prefill values, e.g. when duplicating an existing schedule. */
  initialValue?: RecurringInitialValue;
  /** Renders the duplicate-specific title/notice when true. */
  duplicate?: boolean;
}

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

const today = () => new Date().toISOString().slice(0, 10);

/** Normalizes a raw `exceptions` value (jsonb) into a sorted, unique date list. */
function normalizeExceptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const value of raw) {
    if (typeof value === 'string' && value.trim()) unique.add(value.trim());
  }
  return Array.from(unique).sort();
}

function buildInitialForm(initialValue?: RecurringInitialValue): FormState {
  return {
    invoice_number: initialValue?.invoice_number ? String(initialValue.invoice_number) : '',
    client_name: initialValue?.client_name ? String(initialValue.client_name) : '',
    amount:
      initialValue?.amount !== undefined && initialValue?.amount !== null && initialValue?.amount !== ''
        ? String(initialValue.amount)
        : '',
    currency: initialValue?.currency ? String(initialValue.currency) : 'USD',
    frequency: initialValue?.frequency ? String(initialValue.frequency) : 'monthly',
    next_date: initialValue?.next_date ? String(initialValue.next_date) : today(),
    status: initialValue?.status ? String(initialValue.status) : 'active',
    notes: initialValue?.notes ? String(initialValue.notes) : '',
  };
}

const fieldClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2';

/**
 * Reusable editor for a recurring invoice schedule. Mirrors the flat-amount
 * model (no line items) and adds a per-schedule "skip dates" (exceptions)
 * editor whose values are persisted to the `recurring_invoices.exceptions`
 * jsonb column and honored by the generator cron. Used by the New page for
 * both fresh creation and "Duplicate schedule" prefill.
 */
export default function RecurringScheduleEditor({ initialValue, duplicate = false }: RecurringScheduleEditorProps) {
  const t = useTranslations('recurringPage');
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialForm(initialValue));
  const [exceptions, setExceptions] = useState<string[]>(() => normalizeExceptions(initialValue?.exceptions));
  const [exceptionDraft, setExceptionDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addException = () => {
    const value = exceptionDraft.trim();
    if (!value) return;
    if (exceptions.includes(value)) {
      setError(t('new.exceptions.duplicate'));
      return;
    }
    setExceptions((prev) => [...prev, value].sort());
    setExceptionDraft('');
    setError(null);
  };

  const removeException = (value: string) => {
    setExceptions((prev) => prev.filter((item) => item !== value));
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

      const basePayload = {
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

      let { error: insertError } = await supabase
        .from('recurring_invoices')
        .insert({ ...basePayload, exceptions });

      // Gracefully degrade if the `exceptions` column hasn't been migrated yet,
      // so creating a schedule never regresses ahead of the DB migration.
      if (insertError && (insertError.code === 'PGRST204' || /exceptions/i.test(insertError.message || ''))) {
        const retry = await supabase.from('recurring_invoices').insert(basePayload);
        insertError = retry.error;
      }

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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        {duplicate ? t('new.duplicateTitle') : t('new.title')}
      </h1>
      {duplicate && (
        <p className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          {t('new.duplicateNotice')}
        </p>
      )}
      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div>
          <label htmlFor="invoice-number" className="block text-sm font-medium mb-1">{t('new.fields.invoiceNumber')}</label>
          <input id="invoice-number" name="invoice_number" value={form.invoice_number} onChange={(e) => updateField('invoice_number', e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="client-name" className="block text-sm font-medium mb-1">{t('new.fields.clientName')}</label>
          <input id="client-name" name="client_name" value={form.client_name} onChange={(e) => updateField('client_name', e.target.value)} className={fieldClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-1">{t('new.fields.amount')}</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => updateField('amount', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium mb-1">{t('new.fields.currency')}</label>
            <input id="currency" name="currency" value={form.currency} onChange={(e) => updateField('currency', e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="frequency" className="block text-sm font-medium mb-1">{t('new.fields.frequency')}</label>
            <select id="frequency" name="frequency" value={form.frequency} onChange={(e) => updateField('frequency', e.target.value)} className={fieldClass}>
              <option value="weekly">{t('frequency.weekly')}</option>
              <option value="biweekly">{t('frequency.biweekly')}</option>
              <option value="monthly">{t('frequency.monthly')}</option>
              <option value="quarterly">{t('frequency.quarterly')}</option>
              <option value="yearly">{t('frequency.yearly')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="next-date" className="block text-sm font-medium mb-1">{t('new.fields.nextDate')}</label>
            <input id="next-date" name="next_date" type="date" value={form.next_date} onChange={(e) => updateField('next_date', e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">{t('new.fields.status')}</label>
          <select id="status" name="status" value={form.status} onChange={(e) => updateField('status', e.target.value)} className={fieldClass}>
            <option value="active">{t('new.status.active')}</option>
            <option value="paused">{t('new.status.paused')}</option>
            <option value="cancelled">{t('new.status.cancelled')}</option>
          </select>
        </div>

        {/* Skip dates (exceptions) */}
        <div>
          <label htmlFor="exception-date" className="block text-sm font-medium mb-1">{t('new.fields.exceptions')}</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('new.exceptions.hint')}</p>
          <div className="flex gap-2">
            <input
              id="exception-date"
              type="date"
              value={exceptionDraft}
              onChange={(e) => setExceptionDraft(e.target.value)}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addException}
              disabled={!exceptionDraft}
              className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              {t('new.exceptions.add')}
            </button>
          </div>
          {exceptions.length === 0 ? (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('new.exceptions.empty')}</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('new.fields.exceptions')}>
              {exceptions.map((value) => (
                <li
                  key={value}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200"
                >
                  <span>{value}</span>
                  <button
                    type="button"
                    onClick={() => removeException(value)}
                    aria-label={`${t('new.exceptions.remove')} ${value}`}
                    className="text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">{t('new.fields.notes')}</label>
          <textarea id="notes" name="notes" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} className={fieldClass} />
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
