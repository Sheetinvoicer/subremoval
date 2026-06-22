'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  country?: string;
  created_at: string;
}

export default function ClientDetailPage() {
  const t = useTranslations('clientsPage');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClient();
  }, [id]);

  async function loadClient() {
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
        setError(authError?.message || t('errors.loginRequiredViewSingle'));
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('user_id', authData.user.id)
        .single();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setClient(data as Client);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedLoadClient');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!client || deleting || !window.confirm(t('confirmDelete'))) {
      return;
    }

    try {
      setDeleting(true);
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('errors.loginRequiredDelete'));
        return;
      }

      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)
        .eq('user_id', authData.user.id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      router.push('/dashboard/clients');
    } finally {
      setDeleting(false);
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
          <p className="text-red-600 dark:text-red-400">{t('errorPrefix')}: {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('actions.goBack')}
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-600 dark:text-yellow-400">{t('clientNotFound')}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('actions.goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {client.name}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/dashboard/clients/${id}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('actions.editClient')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deleting ? t('actions.deleting') : t('actions.delete')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('fields.email')}</h3>
            <p className="text-gray-900 dark:text-white">{client.email}</p>
          </div>
          {client.phone && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('fields.phone')}</h3>
              <p className="text-gray-900 dark:text-white">{client.phone}</p>
            </div>
          )}
          {client.company && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('fields.company')}</h3>
              <p className="text-gray-900 dark:text-white">{client.company}</p>
            </div>
          )}
          {client.address && (
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('fields.address')}</h3>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{client.address}</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {t('actions.backToClients')}
          </button>
        </div>
      </div>
    </div>
  );
}
