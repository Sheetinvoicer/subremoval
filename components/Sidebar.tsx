'use client'

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { hasRequiredRole, normalizeRole, ROLES } from '@/lib/auth/roles';
import { useLocale, useTranslations } from 'next-intl';

const navItems = [
  { key: 'dashboard', href: '/dashboard', icon: '📊' },
  { key: 'invoices', href: '/dashboard/invoices', icon: '📄' },
  { key: 'clients', href: '/dashboard/clients', icon: '👥' },
  { key: 'projects', href: '/dashboard/projects', icon: '🗂️' },
  { key: 'expenses', href: '/dashboard/expenses', icon: '💰' },
  { key: 'recurring', href: '/dashboard/recurring', icon: '🔄' },
  { key: 'estimates', href: '/dashboard/estimates', icon: '📋' },
  { key: 'time', href: '/dashboard/time', icon: '⏱️' },
  { key: 'reports', href: '/dashboard/reports', icon: '📈' },
  { key: 'admin', href: '/dashboard/admin', icon: '🛡️' },
  { key: 'settings', href: '/dashboard/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const t = useTranslations('sidebar');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [role, setRole] = useState(ROLES.VIEWER);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadRole = async () => {
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      setRole(normalizeRole(data?.role));
    };

    loadRole();
  }, [supabase]);

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/dashboard/admin') {
      return hasRequiredRole(role, ROLES.ADMIN);
    }
    return true;
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed top-4 z-50 bg-purple-600 text-white p-2 rounded-lg shadow-lg ${isRtl ? 'right-4' : 'left-4'}`}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Overlay */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 h-full z-40 w-64 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800
        ${isRtl ? 'right-0 border-l' : 'left-0 border-r'}
        transition-transform duration-300
        ${isMobile && !isOpen ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-purple-600">SheetInvoicer</h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => isMobile && setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isRtl ? 'flex-row-reverse text-right' : ''} ${
                  pathname === item.href
                    ? 'bg-purple-100 text-purple-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{t(`items.${item.key}`)}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all ${isRtl ? 'flex-row-reverse text-right' : ''}`}
            >
              <span className="text-xl">🚪</span>
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for desktop */}
      {!isMobile && <div className="w-64 flex-shrink-0" />}
    </>
  );
}
