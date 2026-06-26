'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { FormPageSkeleton } from '@/components/LoadingSkeleton';
import RecurringScheduleEditor, { type RecurringInitialValue } from '@/components/recurring/RecurringScheduleEditor';

export default function NewRecurringPage() {
  const t = useTranslations('recurringPage');
  // Read the optional `?duplicateFrom=<id>` on the client to avoid forcing a
  // Suspense boundary (useSearchParams) around an otherwise simple page.
  const [duplicateFromId, setDuplicateFromId] = useState<string | null>(null);
  const [initialValue, setInitialValue] = useState<RecurringInitialValue | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('duplicateFrom');
    setDuplicateFromId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadSource = async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setLoadError(t('errors.supabaseInit'));
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('invoice_number, client_name, amount, currency, frequency, next_date, status, notes, exceptions')
        .eq('id', id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setLoadError(t('new.duplicateLoadFailed'));
      } else {
        setInitialValue(data as RecurringInitialValue);
      }
      setLoading(false);
    };

    loadSource();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return <FormPageSkeleton fields={8} />;
  }

  if (loadError) {
    return (
      <div className="p-6 md:p-8 max-w-2xl">
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
      </div>
    );
  }

  return <RecurringScheduleEditor initialValue={initialValue} duplicate={Boolean(duplicateFromId)} />;
}
