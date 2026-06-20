'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface IFormData {
  client_id: string;
  items: { description: string; quantity: number; price: number }[];
  notes: string;
  tax_rate: number;
  currency: string;
}

export default function NewEstimatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<IFormData>({
    client_id: '',
    items: [{ description: '', quantity: 1, price: 0 }],
    notes: '',
    tax_rate: 0,
    currency: 'USD',
  });

  useEffect(() => {
    const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_KEY');
    if (!supabase) {
      setError('Supabase client could not be created');
      return;
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">New Estimate</h1>
      <button onClick={() => router.back()}>Cancel</button>
    </div>
  );
}