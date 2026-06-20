'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Invoices', href: '/dashboard/invoices', icon: '📄' },
  { name: 'Clients', href: '/dashboard/clients', icon: '👥' },
  { name: 'Expenses', href: '/dashboard/expenses', icon: '💰' },
  { name: 'Estimates', href: '/dashboard/estimates', icon: '📋' },
  { name: 'Recurring', href: '/dashboard/recurring', icon: '🔄' },
  { name: 'Reports', href: '/dashboard/reports', icon: '📈' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export default function GlassSidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-2 rounded-lg shadow-lg"
      >
        ☰
      </button>

      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
        className="fixed left-0 top-0 z-40 h-screen w-64 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-white/20 dark:border-gray-700/50 shadow-xl"
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              SheetInvoicer
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    pathname === item.href
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              </motion.div>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2">
            <LanguageSwitcher />
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left text-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/30 transition-all"
            >
              <span className="text-xl">🚪</span>
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
