'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  address: string;
}

const initialForm: FormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  country: '',
  address: '',
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return 'Client name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!isValidEmail(form.email.trim())) return 'Please enter a valid email address.';
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
      setError('Failed to initialize Supabase client');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || 'Please log in to create clients');
        return;
      }

      const payload = {
        user_id: authData.user.id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        country: form.country.trim() || null,
        address: form.address.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from('clients')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push(`/dashboard/clients/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">New Client</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Name *" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Email *" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.company} onChange={(e) => updateField('company', e.target.value)} placeholder="Company" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <input value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder="Country" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
        <textarea value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Address" rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg disabled:opacity-60">
            {submitting ? 'Saving...' : 'Create Client'}
          </button>
          <Link href="/dashboard/clients" className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
