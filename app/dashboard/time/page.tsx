'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatMinutesAsHoursMinutes } from '@/lib/timeTracking';
import { TableListSkeleton } from '@/components/LoadingSkeleton';
import { useTranslations } from 'next-intl';

interface ClientItem {
  id: string;
  name: string;
}

interface InvoiceItem {
  id: string;
  invoice_number: string;
}

interface TimeEntry {
  id: string;
  description: string;
  duration_minutes: number;
  entry_date: string;
  client_id?: string | null;
  invoice_id?: string | null;
  billable: boolean;
  created_at: string;
  clients?: { name?: string | null } | null;
  invoices?: { invoice_number?: string | null } | null;
}

export default function TimeTrackingPage() {
  const t = useTranslations('timePage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);

  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [billable, setBillable] = useState(true);

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartAt, setTimerStartAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = createClient();
        if (!supabase) {
          setError(t('errors.supabaseInit'));
          return;
        }

        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) {
          setError(t('errors.loginRequired'));
          return;
        }

        const [entryRes, clientsRes, invoicesRes] = await Promise.all([
          supabase
            .from('time_entries')
            .select('id,description,duration_minutes,entry_date,client_id,invoice_id,billable,created_at,clients(name),invoices(invoice_number)')
            .eq('user_id', user.id)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase.from('clients').select('id,name').eq('user_id', user.id).order('name', { ascending: true }),
          supabase
            .from('invoices')
            .select('id,invoice_number')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        if (entryRes.error) throw new Error(entryRes.error.message);
        if (clientsRes.error) throw new Error(clientsRes.error.message);
        if (invoicesRes.error) throw new Error(invoicesRes.error.message);

        setEntries((entryRes.data || []) as TimeEntry[]);
        setClients((clientsRes.data || []) as ClientItem[]);
        setInvoices((invoicesRes.data || []) as InvoiceItem[]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!timerRunning || !timerStartAt) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - timerStartAt.getTime()) / 1000));
      setElapsedSeconds(seconds);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning, timerStartAt]);

  const totalMinutes = useMemo(() => entries.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0), [entries]);

  const billableMinutes = useMemo(
    () => entries.filter((entry) => entry.billable !== false).reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0),
    [entries],
  );

  const startTimer = () => {
    setTimerStartAt(new Date());
    setElapsedSeconds(0);
    setTimerRunning(true);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setDurationMinutes(minutes);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerStartAt(null);
    setElapsedSeconds(0);
  };

  const createEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError(t('errors.descriptionRequired'));
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError(t('errors.durationInvalid'));
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(t('errors.supabaseInit'));
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        throw new Error(t('errors.loginCreate'));
      }

      const minutes = Number(durationMinutes);
      const { data: inserted, error: insertError } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          description: description.trim(),
          duration_minutes: minutes,
          hours: Math.round((minutes / 60) * 100) / 100,
          entry_date: entryDate,
          client_id: clientId || null,
          invoice_id: invoiceId || null,
          billable,
        })
        .select('id,description,duration_minutes,entry_date,client_id,invoice_id,billable,created_at,clients(name),invoices(invoice_number)')
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      setEntries((prev) => [inserted as TimeEntry, ...prev]);
      setDescription('');
      setDurationMinutes(30);
      setInvoiceId('');
      setBillable(true);
      resetTimer();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('errors.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <TableListSkeleton />;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/reports" className="text-sm text-blue-600 hover:underline">
          {t('viewReports')}
        </Link>
      </div>

      {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.totalTracked')}</p><p className="text-2xl font-bold">{formatMinutesAsHoursMinutes(totalMinutes)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.billable')}</p><p className="text-2xl font-bold text-green-600">{formatMinutesAsHoursMinutes(billableMinutes)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.nonBillable')}</p><p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{formatMinutesAsHoursMinutes(totalMinutes - billableMinutes)}</p></div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('timer.title')}</h2>
        <p className="text-3xl font-mono">{new Date(elapsedSeconds * 1000).toISOString().slice(11, 19)}</p>
        <div className="flex gap-2">
          {!timerRunning ? (
            <button type="button" onClick={startTimer} className="px-4 py-2 rounded-lg bg-green-600 text-white">{t('timer.start')}</button>
          ) : (
            <button type="button" onClick={stopTimer} className="px-4 py-2 rounded-lg bg-yellow-500 text-white">{t('timer.stop')}</button>
          )}
          <button type="button" onClick={resetTimer} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">{t('timer.reset')}</button>
        </div>
      </div>

      <form onSubmit={createEntry} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('form.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.description')}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" placeholder={t('form.descriptionPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.duration')}</label>
            <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.date')}</label>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.client')}</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">{t('form.unassigned')}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.invoice')}</label>
            <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">{t('form.notLinked')}</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-7">
            <input id="billable" type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
            <label htmlFor="billable" className="text-sm">{t('form.billable')}</label>
          </div>
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">
          {saving ? t('form.saving') : t('form.save')}
        </button>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">{t('entries.title')}</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">{t('entries.empty')}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-sm text-gray-500">
                      {entry.clients?.name || t('entries.noClient')} · {entry.invoices?.invoice_number ? `${t('entries.invoice')} ${entry.invoices.invoice_number}` : t('entries.notInvoiced')} · {new Date(entry.entry_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMinutesAsHoursMinutes(entry.duration_minutes)}</p>
                    <p className="text-xs text-gray-500">{entry.billable ? t('entries.billable') : t('entries.nonBillable')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
