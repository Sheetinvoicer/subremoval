'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Invoices', href: '/dashboard/invoices', icon: '📄' },
  { name: 'Clients', href: '/dashboard/clients', icon: '👥' },
  { name: 'Expenses', href: '/dashboard/expenses', icon: '💰' },
  { name: 'Recurring', href: '/dashboard/recurring', icon: '🔄' },
  { name: 'Estimates', href: '/dashboard/estimates', icon: '📋' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggleMobileMenu', handleToggle);
    return () => window.removeEventListener('toggleMobileMenu', handleToggle);
  }, []);

  // Close menu when navigating
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 lg:hidden">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold">Menu</h2>
        <button onClick={() => setIsOpen(false)} className="text-2xl">✕</button>
      </div>
      <nav className="flex flex-col p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              pathname === item.href
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
