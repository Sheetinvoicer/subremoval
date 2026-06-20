'use client';
import React, { useState } from 'react';

import Link from 'next/link';
import { motion } from 'framer-motion';

const settingsSections = [
  { title: 'Currency Settings', description: 'Set your default currency and exchange rates', icon: '💱', href: '/dashboard/settings/currency', color: 'blue' },
  { title: 'Payment Reminders', description: 'Configure automatic payment reminders', icon: '🔔', href: '/dashboard/settings/reminders', color: 'purple' },
  { title: 'Subscription', description: 'Manage your plan and billing', icon: '💳', href: '/dashboard/subscription', color: 'emerald' },
  { title: 'Business Profile', description: 'Update your business information', icon: '🏢', href: '/dashboard/settings/profile', color: 'orange' },
  { title: 'Team Members', description: 'Invite and manage team members', icon: '👥', href: '/dashboard/settings/team', color: 'pink' },
  { title: 'API Keys', description: 'Manage API access for developers', icon: '🔑', href: '/dashboard/settings/api', color: 'indigo' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your account preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsSections.map((section, idx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -5 }}
          >
            <Link href={section.href}>
              <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 cursor-pointer transition-all hover:shadow-xl`}>
                <div className={`text-4xl mb-3 bg-${section.color}-100 dark:bg-${section.color}-900/20 inline-block p-3 rounded-2xl`}>
                  {section.icon}
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{section.title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{section.description}</p>
                <div className="mt-4 text-${section.color}-600 dark:text-${section.color}-400">Configure →</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
