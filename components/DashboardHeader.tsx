'use client'

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useRef, useState } from 'react';
import { Bell, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

// Maps a dashboard pathname to a `sidebar.items` translation key.
const TITLE_KEYS: { match: string; key: string }[] = [
  { match: '/dashboard/subscriptions/scan', key: 'scan' },
  { match: '/dashboard/subscriptions', key: 'subscriptions' },
  { match: '/dashboard/settings', key: 'settings' },
  { match: '/dashboard', key: 'dashboard' },
];

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '');
  if (!source) return '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function DashboardHeader() {
  const t = useTranslations('sidebar');
  const th = useTranslations('header');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUser = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      setEmail(user.email ?? null);
      setName(
        (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          null
      );
    };
    loadUser();
  }, [supabase]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const titleEntry = TITLE_KEYS.find((e) => pathname.startsWith(e.match));
  const pageTitle = titleEntry ? t(`items.${titleEntry.key}`) : t('items.dashboard');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const dropdownSide = isRtl ? 'left-0' : 'right-0';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md md:px-6">
      {/* Page title */}
      <h2 className={`truncate text-lg font-semibold text-text-primary ${isRtl ? 'pr-12 md:pr-0' : 'pl-12 md:pl-0'}`}>
        {pageTitle}
      </h2>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            aria-label={th('notifications')}
            className="relative rounded-button p-2 text-text-secondary transition-all duration-250 hover:bg-accent/10 hover:text-text-primary"
          >
            <Bell size={20} />
          </button>
          {notifOpen && (
            <div
              className={`absolute ${dropdownSide} mt-2 w-64 rounded-card border border-border bg-card p-4 shadow-card`}
            >
              <p className="mb-1 text-sm font-medium text-text-primary">
                {th('notifications')}
              </p>
              <p className="text-sm text-text-secondary">{th('noNotifications')}</p>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-button p-1.5 text-text-secondary transition-all duration-250 hover:bg-accent/10"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-secondary text-xs font-semibold text-white">
              {getInitials(name, email)}
            </span>
            <span className="hidden max-w-[8rem] truncate text-sm text-text-primary sm:inline">
              {name || (email ? email.split('@')[0] : th('account'))}
            </span>
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div
              className={`absolute ${dropdownSide} mt-2 w-56 overflow-hidden rounded-card border border-border bg-card shadow-card`}
            >
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-sm font-medium text-text-primary">
                  {name || th('account')}
                </p>
                <p className="truncate text-xs text-text-secondary">{email || ''}</p>
              </div>
              <Link
                href="/dashboard/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary transition-colors duration-250 hover:bg-accent/10 hover:text-text-primary"
              >
                <Settings size={16} />
                {t('items.settings')}
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors duration-250 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <LogOut size={16} />
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
