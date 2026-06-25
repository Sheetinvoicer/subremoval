"use client";
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BankTransaction } from '@/components/TransactionList';

interface InvoiceOption {
  id: string;
  invoice_number?: string | null;
  total: number;
  currency?: string | null;
  status?: string | null;
}

interface InvoiceMatchProps {
  transaction: BankTransaction;
  onClose: () => void;
  onMatched: () => void;
}

function amountsMatch(a: number, b: number) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.01;
}

export default function InvoiceMatch({ transaction, onClose, onMatched }: InvoiceMatchProps) {
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = createClient();
        if (!supabase) {
          setError('Could not initialise Supabase.');
          return;
        }
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          setError('You must be logged in.');
          return;
        }
        const { data, error: queryError } = await supabase
          .from('invoices')
          .select('id, invoice_number, total, currency, status')
          .eq('user_id', authData.user.id)
          .neq('status', 'paid')
          .order('created_at', { ascending: false });

        if (queryError) {
          setError(queryError.message);
          return;
        }

        const options = (data || []) as InvoiceOption[];
        setInvoices(options);
        // Pre-select the first invoice whose total matches the transaction.
        const suggestion = options.find((inv) => amountsMatch(inv.total, transaction.amount));
        if (suggestion) setSelectedId(suggestion.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoices.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [transaction.amount]);

  const suggestedId = useMemo(() => {
    const suggestion = invoices.find((inv) => amountsMatch(inv.total, transaction.amount));
    return suggestion?.id ?? null;
  }, [invoices, transaction.amount]);

  const handleConfirm = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      setError(null);
      const supabase = createClient();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch('/api/bank/reconcile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId: transaction.id, invoiceId: selectedId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to match invoice.');
      }

      onMatched();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to match invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Match to invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {transaction.description || transaction.stripe_transaction_id} ·{' '}
          <span className="font-medium text-gray-900 dark:text-white">
            {transaction.currency.toUpperCase()} {Number(transaction.amount).toFixed(2)}
          </span>
        </p>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid invoices to match.</p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select an invoice…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number || inv.id.slice(0, 8)} ·{' '}
                {(inv.currency || 'usd').toUpperCase()} {Number(inv.total).toFixed(2)}
                {inv.id === suggestedId ? ' (suggested)' : ''}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId || saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {saving ? 'Matching…' : 'Match & mark paid'}
          </button>
        </div>
      </div>
    </div>
  );
}
