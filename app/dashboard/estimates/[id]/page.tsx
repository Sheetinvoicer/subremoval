'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Estimate {
  id: string;
  estimate_number: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface PageProps {
  params: { id: string };
}

export default function EstimateDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEstimate();
  }, [params]);

  async function loadEstimate() {
    try {
      setLoading(true);
      setError(null);

      const id = params.id;
      const supabase = createClient();

      if (!supabase) {
        setError('Failed to create Supabase client');
        return;
      }

      const { data, error: queryError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .single();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setEstimate(data);
      } else {
        setError('Estimate not found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load estimate';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Estimate #{estimate.estimate_number}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Created: {new Date(estimate.created_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</h3>
            <p className="text-gray-900 dark:text-white">{estimate.client_name}</p>
            <p className="text-gray-600 dark:text-gray-300">{estimate.client_email}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {estimate.currency} {estimate.amount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}