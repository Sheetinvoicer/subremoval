'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  client_id?: string | null;
}

interface ClientItem { id: string; name: string; }

const statuses = ['planning', 'active', 'on_hold', 'completed', 'archived'];

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setError('Please log in to edit project.');
        return;
      }

      const [{ data: projectData, error: projectError }, { data: clientsData }] = await Promise.all([
        supabase.from('projects').select('id, name, description, status, client_id').eq('user_id', user.id).eq('id', id).single(),
        supabase.from('clients').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
      ]);

      if (projectError) {
        setError(projectError.message);
      } else {
        setProject(projectData as Project);
        setClients((clientsData as ClientItem[]) || []);
      }
    };
    loadData();
  }, [id]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project) return;
    if (!project.name.trim()) {
      setError('Project name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      setError('Failed to initialize Supabase client');
      return;
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        name: project.name.trim(),
        description: project.description?.trim() || null,
        status: project.status,
        client_id: project.client_id || null,
      })
      .eq('id', project.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/projects/${project.id}`);
  };

  if (!project && !error) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Edit Project</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>}

      {project && (
        <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
          <input value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} placeholder="Project name *" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
          <textarea value={project.description || ''} onChange={(e) => setProject({ ...project, description: e.target.value })} placeholder="Description" rows={4} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2" />
          <select value={project.status} onChange={(e) => setProject({ ...project, status: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2">
            {statuses.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={project.client_id || ''} onChange={(e) => setProject({ ...project, client_id: e.target.value || null })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2">
            <option value="">No linked client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Project'}
            </button>
            <Link href={`/dashboard/projects/${project.id}`} className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
