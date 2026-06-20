'use client';
import React from 'react';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Activity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    loadActivities();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('activities')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'activity_logs' 
      }, () => {
        loadActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadActivities() {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error && data) {
      setActivities(data);
    }
    setLoading(false);
  }

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'invoice_created': return '📄';
      case 'invoice_paid': return '✅';
      case 'invoice_sent': return '📧';
      case 'client_added': return '👥';
      case 'expense_added': return '💰';
      default: return '📌';
    }
  };

  const getActivityColor = (type: string) => {
    switch(type) {
      case 'invoice_paid': return 'text-green-500';
      case 'invoice_created': return 'text-blue-500';
      case 'client_added': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
        <h3 className="font-bold mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
        <h3 className="font-bold mb-3">Recent Activity</h3>
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">No activity yet</p>
          <p className="text-xs mt-1">Create an invoice or add a client</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <span>📋</span> Recent Activity
      </h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className={`text-xl ${getActivityColor(activity.type)}`}>
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {activity.description}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(activity.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
