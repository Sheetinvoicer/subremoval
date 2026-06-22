'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  address: string;
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function EditClientPage() {
  const t = useTranslations('clientsPage');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', company: '', country: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClient = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('errors.loginRequiredEdit'));
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('clients')
        .select('name, email, phone, company, country, address')
        .eq('id', id)
        .eq('user_id', authData.user.id)
        .single();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        company: data.company || '',
        country: data.country || '',
        address: data.address || '',
      });
      setLoading(false);
    };

    loadClient();
  }, [id]);

  const updateField = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    if (!form.name.trim()) return t('validation.nameRequired');
    if (!form.email.trim()) return t('validation.emailRequired');
    if (!isValidEmail(form.email.trim())) return t('validation.emailInvalid');
    return null;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(t('errors.supabaseInit'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('errors.loginRequiredEdit'));
        return;
      }

      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          country: form.country.trim() || null,
          address: form.address.trim() || null,
        })
        .eq('id', id)
        .eq('user_id', authData.user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push(`/dashboard/clients/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('loadingSingle')}</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('editTitle')}</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder={t('fields.nameRequired')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder={t('fields.emailRequired')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder={t('fields.phone')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.company} onChange={(e) => updateField('company', e.target.value)} placeholder={t('fields.company')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder={t('fields.country')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <textarea value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder={t('fields.address')} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg disabled:opacity-60">
            {submitting ? t('actions.saving') : t('actions.saveChanges')}
          </button>
          <Link href={`/dashboard/clients/${id}`} className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600">{t('actions.cancel')}</Link>
        </div>
      </form>
    </div>
  );
}
