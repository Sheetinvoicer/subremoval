'use client'

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, memo } from 'react';
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
  Landmark,
  Repeat,
  ClipboardList,
  Clock,
  TrendingUp,
  Shield,
  ScrollText,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { hasRequiredRole, normalizeRole, ROLES } from '@/lib/auth/roles';
import { useLocale, useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';

type NavItem = { key: string; href: string; Icon: LucideIcon; badge?: string };
type NavSection = { key: string; items: NavItem[] };

// Grouped, enterprise-style navigation. Sections are labelled and rendered in
// order; a section is hidden entirely when none of its items are visible for
// the current role.
const navSections: NavSection[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', href: '/dashboard', Icon: LayoutDashboard },
      { key: 'reports', href: '/dashboard/reports', Icon: TrendingUp },
    ],
  },
  {
    key: 'sales',
    items: [
      { key: 'clients', href: '/dashboard/clients', Icon: Users },
      { key: 'invoices', href: '/dashboard/invoices', Icon: FileText },
      { key: 'estimates', href: '/dashboard/estimates', Icon: ClipboardList },
      { key: 'recurring', href: '/dashboard/recurring', Icon: Repeat },
    ],
  },
  {
    key: 'finance',
    items: [
      { key: 'expenses', href: '/dashboard/expenses', Icon: Wallet },
      { key: 'bank', href: '/dashboard/bank', Icon: Landmark },
    ],
  },
  {
    key: 'workspace',
    items: [
      { key: 'projects', href: '/dashboard/projects', Icon: FolderKanban },
      { key: 'time', href: '/dashboard/time', Icon: Clock },
    ],
  },
  {
    key: 'administration',
    items: [
      { key: 'admin', href: '/dashboard/admin', Icon: Shield },
      { key: 'adminAi', href: '/dashboard/admin/ai', Icon: Sparkles, badge: 'AI' },
      { key: 'auditLogs', href: '/dashboard/admin/audit-logs', Icon: ScrollText },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'subscription', href: '/dashboard/subscription', Icon: CreditCard },
      { key: 'settings', href: '/dashboard/settings', Icon: Settings },
    ],
  },
];

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '');
  if (!source) return '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Sidebar() {
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

      // Resolve the effective role from the server so the email-based admin
      // bootstrap is honoured (matches middleware + admin APIs).
      try {
        const res = await fetch('/api/auth/role', { cache: 'no-store' });
        const payload = await res.json().catch(() => null);
        setRole(normalizeRole(payload?.role));
      } catch {
        setRole(ROLES.VIEWER);
      }

      // Use maybeSingle (not single): users on the Free tier may have no
      // subscriptions row yet, and single() would return a PostgREST 406
      // ("Cannot coerce the result to a single JSON object") on every page load.
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', user.id)
        .maybeSingle();
      setPlan(subscription?.plan ?? 'Free');
    };

    loadUser();
  }, [supabase]);

  const isItemVisible = (href: string) =>
    href.startsWith('/dashboard/admin') ? hasRequiredRole(role, ROLES.ADMIN) : true;

  const visibleSections = navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => isItemVisible(item.href)) }))
    .filter((section) => section.items.length > 0);

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
          className={`fixed top-4 z-50 bg-accent text-white p-2 rounded-button shadow-glow transition-colors duration-150 hover:bg-accent/90 ${
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
          fixed top-0 h-full z-40 w-64 bg-surface/85 backdrop-blur-xl border-border
          ${isRtl ? 'right-0 border-l' : 'left-0 border-r'}
          transition-transform duration-300 ease-out
          ${isMobile && !isOpen ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link href="/dashboard" className={`inline-flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-button bg-gradient-to-br from-accent to-accent-secondary text-white shadow-glow-sm">
                <Sparkles size={16} />
              </span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                SheetInvoicer
              </h1>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-5 overflow-y-auto p-3">
            {visibleSections.map((section) => (
              <div key={section.key} className="space-y-1">
                <p
                  className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary/70 ${
                    isRtl ? 'text-right' : ''
                  }`}
                >
                  {t(`sections.${section.key}`)}
                </p>
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.Icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => isMobile && setIsOpen(false)}
                      className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-button text-sm transition-colors duration-150 ${
                        isRtl ? 'flex-row-reverse text-right' : ''
                      } ${
                        active
                          ? 'bg-gradient-to-r from-accent/20 to-accent-secondary/10 text-accent font-semibold shadow-glow-sm'
                          : 'text-text-secondary hover:text-text-primary hover:bg-accent/10'
                      }`}
                    >
                      {/* Left accent border (active or hover) */}
                      <span
                        className={`absolute top-1.5 bottom-1.5 w-0.5 rounded-full transition-opacity duration-150 ${
                          isRtl ? 'right-0' : 'left-0'
                        } ${active ? 'bg-accent opacity-100' : 'bg-accent opacity-0 group-hover:opacity-100'}`}
                      />
                      <Icon size={18} className="shrink-0" />
                      <span className="flex-1">{t(`items.${item.key}`)}</span>
                      {item.badge && (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
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
                className="p-2 rounded-button text-text-secondary hover:text-text-primary hover:bg-accent/10 transition-colors duration-150"
              >
                <Settings size={18} />
              </Link>
            </div>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-button text-sm text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-150 ${
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

export default memo(Sidebar);
