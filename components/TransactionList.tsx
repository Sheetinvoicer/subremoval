"use client";
import { useMemo } from 'react';

export interface MatchedInvoice {
  id: string;
  invoice_number?: string | null;
  total?: number | null;
  status?: string | null;
}

export interface BankTransaction {
  id: string;
  stripe_transaction_id: string;
  amount: number;
  currency: string;
  description?: string | null;
  type?: string | null;
  status: string;
  transaction_date: string;
  matched_invoice_id?: string | null;
  reconciled?: boolean;
  invoices?: MatchedInvoice | MatchedInvoice[] | null;
}

interface TransactionListProps {
  transactions: BankTransaction[];
  onMatch?: (transaction: BankTransaction) => void;
}

function formatAmount(amount: number, currency: string) {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

function firstInvoice(
  invoices: BankTransaction['invoices'],
): MatchedInvoice | null {
  if (!invoices) return null;
  return Array.isArray(invoices) ? invoices[0] ?? null : invoices;
}

export default function TransactionList({ transactions, onMatch }: TransactionListProps) {
  const sorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
      ),
    [transactions],
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reconciliation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sorted.map((tx) => {
              const matched = firstInvoice(tx.invoices);
              const isPositive = Number(tx.amount) >= 0;
              return (
                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(tx.transaction_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {tx.description || tx.type || tx.stripe_transaction_id}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${
                      isPositive
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatAmount(tx.amount, tx.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200 capitalize">
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                    {tx.reconciled || matched ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-800 dark:text-green-300">
                        {matched?.invoice_number
                          ? `Matched · ${matched.invoice_number}`
                          : 'Matched'}
                      </span>
                    ) : onMatch ? (
                      <button
                        onClick={() => onMatch(tx)}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Match invoice
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
