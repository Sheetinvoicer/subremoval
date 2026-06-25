'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type RealtimeTransaction = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  type: string | null;
  status: string;
  transaction_date: string;
  matched_invoice_id: string | null;
  reconciled: boolean;
};

type RealtimeBankProps = {
  /** How many recent transactions to show. */
  limit?: number;
  /** Called whenever a live change arrives, so the parent can refresh too. */
  onChange?: () => void;
};

export default function RealtimeBank({ limit = 8, onChange }: RealtimeBankProps) {
  const [transactions, setTransactions] = useState<RealtimeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    loadTransactions();

    // Subscribe to real-time changes on the user's bank transactions. RLS
    // ensures only the current user's rows are streamed.
    const channel = supabase
      .channel('bank-transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          loadTransactions();
          onChange?.();
        },
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTransactions() {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(
        'id, amount, currency, description, type, status, transaction_date, matched_invoice_id, reconciled',
      )
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (!error && data) {
      setTransactions(data as RealtimeTransaction[]);
    }
    setLoading(false);
  }

  const formatAmount = (amount: number, currency: string) => {
    const value = Number(amount || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: (currency || 'usd').toUpperCase(),
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${(currency || '').toUpperCase()}`;
    }
  };

  const LiveBadge = () => (
    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          live ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      />
      {live ? 'Live' : 'Offline'}
    </span>
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
        <h3 className="font-bold mb-3">Live transactions</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Live transactions</h3>
          <LiveBadge />
        </div>
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">🏦</div>
          <p className="text-sm">No transactions yet</p>
          <p className="text-xs mt-1">New bank activity will appear here in real time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">
          <span>🏦</span> Live transactions
        </h3>
        <LiveBadge />
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {transactions.map((tx) => {
          const incoming = Number(tx.amount) >= 0;
          const matched = tx.reconciled || Boolean(tx.matched_invoice_id);
          return (
            <div
              key={tx.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className={`text-xl ${incoming ? 'text-green-500' : 'text-red-500'}`}>
                {incoming ? '⬇️' : '⬆️'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {tx.description || tx.type || 'Transaction'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(tx.transaction_date).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    incoming ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {formatAmount(tx.amount, tx.currency)}
                </p>
                <p className={`text-xs ${matched ? 'text-green-500' : 'text-gray-400'}`}>
                  {matched ? 'Reconciled' : 'Unmatched'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
