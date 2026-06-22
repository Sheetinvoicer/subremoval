'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface ClientItem { id: string; name: string; }

const statuses = ['planning', 'active', 'on_hold', 'completed', 'archived'];

export default function NewProjectPage() {
  const t = useTranslations('projectsPage');
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('planning');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      const { data } = await supabase.from('clients').select('id, name').eq('user_id', user.id).order('name', { ascending: true });
      setClients((data as ClientItem[]) || []);
    };
    loadClients();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t('new.errors.nameRequired'));
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(t('new.errors.supabaseInit'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('new.errors.loginRequired'));
        return;
      }

      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          user_id: authData.user.id,
          name: name.trim(),
          description: description.trim() || null,
          status,
          client_id: clientId || null,
        })
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push(`/dashboard/projects/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('new.title')}</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium mb-1">{t('new.projectNameLabel')}</label>
          <input id="project-name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        </div>
        <div>
          <label htmlFor="project-description" className="block text-sm font-medium mb-1">{t('new.descriptionLabel')}</label>
          <textarea id="project-description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        </div>
        <div>
          <label htmlFor="project-status" className="block text-sm font-medium mb-1">{t('new.statusLabel')}</label>
          <select id="project-status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2">
          {statuses.map((item) => (
            <option key={item} value={item}>{t(`status.${item}` as any)}</option>
          ))}
          </select>
        </div>
        <div>
          <label htmlFor="project-client" className="block text-sm font-medium mb-1">{t('new.clientLabel')}</label>
          <select id="project-client" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2">
            <option value="">{t('new.noClient')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg disabled:opacity-60">
            {submitting ? t('new.saving') : t('new.createProject')}
          </button>
          <Link href="/dashboard/projects" className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600">{t('new.cancel')}</Link>
        </div>
      </form>
    </div>
  );
}
