"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import TransactionList, { type BankTransaction } from '@/components/TransactionList';
import InvoiceMatch from '@/components/InvoiceMatch';
import RealtimeBank from '@/components/RealtimeBank';

interface BalanceBucket {
  amount: number;
  currency: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const supabase = createClient();
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

function sumBuckets(buckets: BalanceBucket[]): number {
  return buckets.reduce((total, bucket) => total + Number(bucket.amount || 0), 0);
}

export default function BankDashboardPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [available, setAvailable] = useState<BalanceBucket[]>([]);
  const [pending, setPending] = useState<BalanceBucket[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<BankTransaction | null>(null);

  const loadAll = useCallback(async (sync: boolean) => {
    try {
      setError(null);
      const headers = await authHeaders();

      const [txRes, balRes] = await Promise.all([
        fetch(`/api/bank/transactions?sync=${sync ? 'true' : 'false'}`, { headers }),
        fetch('/api/bank/balance', { headers }),
      ]);

      const txBody = await txRes.json().catch(() => ({}));
      if (!txRes.ok) throw new Error(txBody.error || 'Failed to load transactions.');
      setTransactions(txBody.transactions || []);
      setConnected(txBody.connected !== false);

      const balBody = await balRes.json().catch(() => ({}));
      if (balRes.ok) {
        setAvailable(balBody.available || []);
        setPending(balBody.pending || []);
        if (balBody.connected === false) setConnected(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank data.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll(true);
      setLoading(false);
    })();
  }, [loadAll]);

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    await loadAll(true);
    setSyncing(false);
  };

  const handleAutoReconcile = async () => {
    try {
      setReconciling(true);
      setNotice(null);
      setError(null);
      const headers = await authHeaders();
      const response = await fetch('/api/bank/reconcile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ auto: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Auto-reconciliation failed.');
      setNotice(`Auto-reconciled ${body.matched || 0} transaction(s).`);
      await loadAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-reconciliation failed.');
    } finally {
      setReconciling(false);
    }
  };

  const insights = useMemo(() => {
    const incoming = transactions.filter((tx) => Number(tx.amount) > 0);
    const outgoing = transactions.filter((tx) => Number(tx.amount) < 0);
    const reconciled = transactions.filter((tx) => tx.reconciled || tx.matched_invoice_id);
    const inflow = incoming.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const outflow = outgoing.reduce((sum, tx) => sum + Number(tx.amount), 0);
    return {
      count: transactions.length,
      inflow,
      outflow,
      net: inflow + outflow,
      reconciledCount: reconciled.length,
      unreconciledCount: transactions.length - reconciled.length,
    };
  }, [transactions]);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-gray-500 dark:text-gray-400">Loading bank data…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Transactions and reconciliation via Stripe Connect
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync transactions'}
          </button>
          <button
            onClick={handleAutoReconcile}
            disabled={reconciling || !connected}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {reconciling ? 'Reconciling…' : 'Auto-reconcile'}
          </button>
        </div>
      </div>

      {!connected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-300">
            No bank connected yet.{' '}
            <Link href="/dashboard/settings?bank=connect" className="underline">
              Connect your bank
            </Link>{' '}
            to import transactions.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {notice && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <p className="text-green-700 dark:text-green-300">{notice}</p>
        </div>
      )}

      {/* Balance + insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Available balance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {sumBuckets(available).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Pending {sumBuckets(pending).toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Net flow</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {insights.net.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            +{insights.inflow.toFixed(2)} / {insights.outflow.toFixed(2)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{insights.count}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Reconciled</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {insights.reconciledCount}
            <span className="text-base font-normal text-gray-400">
              {' '}/ {insights.count}
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{insights.unreconciledCount} unmatched</p>
        </div>
      </div>

      {/* Live, webhook-driven transaction feed (updates in real time). */}
      <div className="mb-6">
        <RealtimeBank onChange={() => loadAll(false)} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Transactions</h2>
      <TransactionList transactions={transactions} onMatch={setSelected} />

      {selected && (
        <InvoiceMatch
          transaction={selected}
          onClose={() => setSelected(null)}
          onMatched={async () => {
            setSelected(null);
            setNotice('Invoice matched and marked as paid.');
            await loadAll(false);
          }}
        />
      )}
    </div>
  );
}
