'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: 'active' | 'on-hold' | 'completed' | 'archived' | string;
  created_at: string;
  clients?: { name?: string } | null;
}

export default function ProjectsPage() {
  const t = useTranslations('projectsPage');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  async function loadProjects() {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError(authError?.message || t('errors.loginRequired'));
        return;
      }

      let query = supabase
        .from('projects')
        .select('id, name, description, status, created_at, clients(name)')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        setError(queryError.message);
        return;
      }

      setProjects((data as Project[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  const projectStats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
    };
  }, [projects]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('loading')}</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600 dark:text-red-400">{t('errorPrefix')}: {error}</div>;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/projects/new" className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all">
          {t('addProject')}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">{t('stats.total')}: {projectStats.total}</div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">{t('stats.active')}: {projectStats.active}</div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">{t('stats.completed')}: {projectStats.completed}</div>
      </div>

      <div className="mb-6 w-56">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900">
          <option value="all">{t('filters.allStatuses')}</option>
          <option value="active">{t('filters.active')}</option>
          <option value="on-hold">{t('filters.on-hold')}</option>
          <option value="completed">{t('filters.completed')}</option>
          <option value="archived">{t('filters.archived')}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project, idx) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {t(`status.${project.status}` as any) || project.status}
              </span>
              <Link href={`/dashboard/projects/${project.id}`} className="text-blue-600 dark:text-blue-400 text-sm">
                {t('card.open')}
              </Link>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{project.name}</h3>
            {project.description && <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">{project.description}</p>}
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('card.client')}: {project.clients?.name || t('card.unassigned')}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
