'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface Estimate {
  id: string;
  estimate_number: string;
  client_id: string;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  subtotal: number;
  tax_amount: number;
  valid_until: string;
}

export default function EstimatesPage() {
  const t = useTranslations('estimatesPage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadEstimates();
  }, []);

  const loadEstimates = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('estimates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError(fetchError.message);
        setEstimates([]);
      } else {
        console.log('Estimates data:', data);
        setEstimates(data || []);
      }
    } catch (err) {
      console.error('Error loading estimates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-700';
      case 'sent': return 'bg-blue-200 text-blue-700';
      case 'accepted': return 'bg-green-200 text-green-700';
      case 'rejected': return 'bg-red-200 text-red-700';
      case 'converted': return 'bg-purple-200 text-purple-700';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('title')}</h1>
        <div className="text-gray-500 dark:text-gray-400">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('title')}</h1>
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {t('errorPrefix')}: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <Link
          href="/dashboard/estimates/new"
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          {t('newEstimate')}
        </Link>
      </div>

      {estimates.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {estimates.map((est) => (
            <Link
              key={est.id}
              href={`/dashboard/estimates/${est.id}`}
              className="block bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {est.estimate_number || t('defaultEstimate')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(est.status)}`}>
                      {est.status || 'draft'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('createdLabel')}: {new Date(est.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {est.currency || 'USD'} {est.total || 0}
                  </p>
                  {est.valid_until && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('validUntilLabel')}: {new Date(est.valid_until).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
