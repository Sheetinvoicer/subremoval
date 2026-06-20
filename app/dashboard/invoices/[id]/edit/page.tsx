'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  items?: any[];
  notes?: string;
  tax_rate?: number;
}

interface PageProps {
  params: { id: string };
}

export default function EditInvoicePage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadInvoice() {
      const { id } = params;
      const supabase = createClient();
      if (!supabase) {
        setError("Failed to initialize Supabase client");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setInvoice(data);
      setLoading(false);
    }

    loadInvoice();
  }, [params]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Failed to initialize Supabase client");
      setSaving(false);
      return;
    }

    const { error: queryError } = await supabase
      .from('invoices')
      .update({
        client_name: invoice.client_name,
        client_email: invoice.client_email,
        amount: invoice.amount,
        currency: invoice.currency,
        due_date: invoice.due_date,
        notes: invoice.notes,
        tax_rate: invoice.tax_rate,
      })
      .eq('id', invoice.id);

    if (queryError) {
      setError(queryError.message);
      toast.error('Failed to update invoice');
      setSaving(false);
      return;
    }

    toast.success('Invoice updated successfully!');
    router.push(`/dashboard/invoices/${invoice.id}`);
    setSaving(false);
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
            onClick={() => router.back()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-600 dark:text-yellow-400">Invoice not found</p>
          <Link href="/dashboard/invoices">
            <a className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Back to Invoices
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Toaster position="top-right" />
      
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/invoices/${invoice.id}`}>
          <a className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            ← Back
          </a>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Invoice #{invoice.invoice_number}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
        {/* form fields */}
      </form>
    </div>
  );
}