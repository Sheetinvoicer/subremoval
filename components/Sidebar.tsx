'use client'

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import {
  Menu,
  X,
  LogOut,
  Settings,
  LayoutDashboard,
  FileText,
  Users,
  FolderKanban,
  Wallet,
  Repeat,
  ClipboardList,
  Clock,
  TrendingUp,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { hasRequiredRole, normalizeRole, ROLES } from '@/lib/auth/roles';
import { useLocale, useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';

const navItems: { key: string; href: string; Icon: LucideIcon }[] = [
  { key: 'dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { key: 'invoices', href: '/dashboard/invoices', Icon: FileText },
  { key: 'clients', href: '/dashboard/clients', Icon: Users },
  { key: 'projects', href: '/dashboard/projects', Icon: FolderKanban },
  { key: 'expenses', href: '/dashboard/expenses', Icon: Wallet },
  { key: 'recurring', href: '/dashboard/recurring', Icon: Repeat },
  { key: 'estimates', href: '/dashboard/estimates', Icon: ClipboardList },
  { key: 'time', href: '/dashboard/time', Icon: Clock },
  { key: 'reports', href: '/dashboard/reports', Icon: TrendingUp },
  { key: 'admin', href: '/dashboard/admin', Icon: Shield },
  { key: 'settings', href: '/dashboard/settings', Icon: Settings },
];

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '');
  if (!source) return '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

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
    const loadUser = async () => {
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      setEmail(user.email ?? null);
      setName(
        (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          null
      );

      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      setRole(normalizeRole(userRow?.role));

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', user.id)
        .single();
      setPlan(subscription?.plan ?? 'Free');
    };

    loadUser();
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

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
          className={`fixed top-4 z-50 bg-accent text-white p-2 rounded-button shadow-glow transition-all duration-250 hover:bg-accent/90 ${
            isRtl ? 'right-4' : 'left-4'
          }`}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      )}

      {/* Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 h-full z-40 w-64 bg-surface border-border
          ${isRtl ? 'right-0 border-l' : 'left-0 border-r'}
          transition-transform duration-300 ease-out
          ${isMobile && !isOpen ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link href="/dashboard" className="inline-flex items-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                SheetInvoicer
              </h1>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.Icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => isMobile && setIsOpen(false)}
                  className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-button text-sm transition-all duration-250 ${
                    isRtl ? 'flex-row-reverse text-right' : ''
                  } ${
                    active
                      ? 'bg-accent/10 text-accent font-semibold shadow-glow-sm'
                      : 'text-text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  {/* Left accent border (active or hover) */}
                  <span
                    className={`absolute top-1.5 bottom-1.5 w-0.5 rounded-full transition-all duration-250 ${
                      isRtl ? 'right-0' : 'left-0'
                    } ${
                      active
                        ? 'bg-accent opacity-100'
                        : 'bg-accent opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <Icon size={18} className="shrink-0" />
                  <span>{t(`items.${item.key}`)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom user section */}
          <div className="p-3 border-t border-border space-y-2">
            <div
              className={`flex items-center gap-3 px-2 py-2 rounded-card bg-card/60 ${
                isRtl ? 'flex-row-reverse text-right' : ''
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-secondary text-sm font-semibold text-white">
                {getInitials(name, email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {name || (email ? email.split('@')[0] : t('account'))}
                </p>
                <p className="truncate text-xs text-text-secondary">{email || ''}</p>
              </div>
            </div>

            <div
              className={`flex items-center justify-between px-2 ${
                isRtl ? 'flex-row-reverse' : ''
              }`}
            >
              {plan && (
                <Badge variant={plan === 'Free' ? 'default' : 'accent'}>
                  {t('planLabel')}: {plan}
                </Badge>
              )}
              <Link
                href="/dashboard/settings"
                onClick={() => isMobile && setIsOpen(false)}
                aria-label={t('items.settings')}
                className="p-2 rounded-button text-text-secondary hover:text-white hover:bg-white/5 transition-all duration-250"
              >
                <Settings size={18} />
              </Link>
            </div>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-button text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-250 ${
                isRtl ? 'flex-row-reverse text-right' : ''
              }`}
            >
              <LogOut size={18} className="shrink-0" />
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
