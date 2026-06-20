'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Invoices', href: '/dashboard/invoices', icon: '📄' },
  { name: 'Clients', href: '/dashboard/clients', icon: '👥' },
  { name: 'Expenses', href: '/dashboard/expenses', icon: '💰' },
  { name: 'Estimates', href: '/dashboard/estimates', icon: '📋' },
  { name: 'Recurring', href: '/dashboard/recurring', icon: '🔄' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export default function ModernSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="fixed left-0 top-0 z-40 h-screen w-72 bg-gradient-to-b from-purple-900 to-indigo-900 text-white shadow-2xl">
      <div className="flex flex-col h-full p-6">
        {/* Logo */}
        <div className="mb-8 mt-4">
          <div className="text-2xl font-bold">✨ SheetInvoicer</div>
          <p className="text-xs text-purple-300 mt-1">Modern Invoicing 2026</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href}>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/10 cursor-pointer ${
                pathname === item.href ? 'bg-white/20' : ''
              }`}>
                <span className="text-2xl">{item.icon}</span>
                <span>{item.name}</span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-300 hover:bg-red-500/20 transition-all"
        >
          <span className="text-2xl">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
