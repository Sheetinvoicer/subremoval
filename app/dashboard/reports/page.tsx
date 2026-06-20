'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Summary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  clientCount: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    invoiceCount: 0,
    clientCount: 0,
  });

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        setError('Failed to initialize Supabase client');
        setLoading(false);
        return;
      }

      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices')
        .select('*');

      if (invoiceError) {
        setError(invoiceError.message);
        setLoading(false);
        return;
      }

      const totalRevenue = (invoices || [])
        .filter((inv: any) => inv.status === 'paid')
        .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);

      setSummary({
        totalRevenue,
        totalExpenses: 0,
        netProfit: totalRevenue,
        invoiceCount: invoices?.length || 0,
        clientCount: 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reports';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Financial overview and analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
          <p className="text-xl font-bold text-green-600">${summary.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Net Profit</p>
          <p className="text-xl font-bold text-blue-600">${summary.netProfit.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Invoices</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.invoiceCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Clients</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.clientCount}</p>
        </div>
      </div>
    </div>
  );
}