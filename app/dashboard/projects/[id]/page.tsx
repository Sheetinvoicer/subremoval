'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  client_id?: string | null;
  clients?: { name?: string; email?: string } | null;
}

interface Invoice {
  id: string;
  invoice_number?: string;
  total: number;
  status: string;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      const supabase = createClient();
      if (!supabase) {
        setError('Failed to initialize Supabase client');
        setLoading(false);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setError('Please log in to view project.');
        setLoading(false);
        return;
      }

      const [{ data: projectData, error: projectError }, { data: invoiceData }] = await Promise.all([
        supabase.from('projects').select('*, clients(name,email)').eq('user_id', user.id).eq('id', id).single(),
        supabase.from('invoices').select('id, invoice_number, total, status').eq('user_id', user.id).eq('project_id', id).order('created_at', { ascending: false }),
      ]);

      if (projectError) {
        setError(projectError.message);
      } else {
        setProject(projectData as Project);
        setInvoices((invoiceData as Invoice[]) || []);
      }
      setLoading(false);
    };

    loadData();
  }, [id]);

  const projectDashboard = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const paid = invoices.filter((item) => item.status === 'paid').length;
    const pending = invoices.filter((item) => item.status === 'pending' || item.status === 'overdue').length;
    return { totalRevenue, invoiceCount: invoices.length, paid, pending };
  }, [invoices]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!project) return <div className="p-6">Project not found.</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{project.description || 'No project description provided.'}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/projects/${project.id}/edit`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</Link>
          <button onClick={() => router.push('/dashboard/projects')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">Status: {project.status}</div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">Client: {project.clients?.name || 'Unassigned'}</div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">Invoices: {projectDashboard.invoiceCount}</div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">Revenue: ${projectDashboard.totalRevenue.toFixed(2)}</div>
      </div>

      <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">Project Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">Paid invoices: {projectDashboard.paid}</div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">Pending invoices: {projectDashboard.pending}</div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">Open amount: ${(invoices.filter((x) => x.status !== 'paid').reduce((sum, item) => sum + Number(item.total || 0), 0)).toFixed(2)}</div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">Project Reports</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p>- Total invoices generated: {projectDashboard.invoiceCount}</p>
          <p>- Total collected amount: ${invoices.filter((x) => x.status === 'paid').reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2)}</p>
          <p>- Total outstanding amount: ${invoices.filter((x) => x.status !== 'paid').reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2)}</p>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-3">Linked Invoices</h3>
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/dashboard/invoices/${invoice.id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
              {invoice.invoice_number || invoice.id} · ${Number(invoice.total || 0).toFixed(2)} · {invoice.status}
            </Link>
          ))}
          {invoices.length === 0 && <p className="text-sm text-gray-500">No linked invoices yet.</p>}
        </div>
      </section>
    </div>
  );
}
