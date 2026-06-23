'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { CardGridSkeleton } from '@/components/LoadingSkeleton';

interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  country?: string;
  created_at: string;
}

export default function ClientsPage() {
  const t = useTranslations('clientsPage');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('errors.loginRequiredView'));
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setClients(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedLoadClients');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <CardGridSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t('errorPrefix')}: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('actions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('subtitle')}</p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all"
        >
          {t('actions.addClient')}
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">{t('noClients')}</p>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div
            key={client.id}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-transform duration-150 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">👤</div>
              <Link href={`/dashboard/clients/${client.id}`} className="text-blue-600 dark:text-blue-400 text-sm">
                {t('actions.edit')}
              </Link>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{client.name}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-1">{client.email}</p>
            {client.phone && <p className="text-gray-500 dark:text-gray-400 text-sm">{client.phone}</p>}
            {client.country && <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">📍 {client.country}</p>}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}