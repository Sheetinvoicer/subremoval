'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface FormDataType {
  client_id: string;
  items: { description: string; quantity: number; price: number }[];
  due_date: string;
  notes: string;
  tax_rate: number;
  currency: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormDataType>({
    client_id: '',
    items: [{ description: '', quantity: 1, price: 0 }],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    tax_rate: 0,
    currency: 'USD',
  });

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client creation failed');
      return;
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">New Invoice</h1>
      <button onClick={() => router.back()}>Cancel</button>
    </div>
  );
}