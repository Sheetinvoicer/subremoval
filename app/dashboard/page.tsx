'use client';

import React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { TooltipProvider } from '@/components/Tooltip';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  Plus,
  ArrowRight,
  Inbox,
  FileText,
} from 'lucide-react';

// Animated number that counts up on mount / value change.
function AnimatedNumber({
  value,
  prefix = '',
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  const positive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? 'text-success' : 'text-red-400'
      }`}
    >
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(change).toFixed(0)}%
    </span>
  );
}

// ===== TYPE DEFINITIONS =====
interface Invoice {
  id: string;
  invoice_number?: string;
  status: string;
  total: number;
  currency?: string;
  due_date?: string;
  created_at: string;
}

interface Stats {
  totalRevenue: number;
  netProfit: number;
  pendingAmount: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalClients: number;
  totalExpenses: number;
  growth: number;
  paidThisMonth: number;
  overdueAmount: number;
  pendingCount: number;
  revenueChange: number;
  pendingChange: number;
  paidThisMonthChange: number;
  overdueChange: number;
}

interface RevenueDataPoint {
  name: string;
  revenue: number;
}

interface StatusDataPoint {
  name: string;
  value: number;
  color: string;
  link: string;
}

// ===== COMPONENT =====
export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // State declarations FIRST
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    netProfit: 0,
    pendingAmount: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalClients: 0,
    totalExpenses: 0,
    growth: 0,
    paidThisMonth: 0,
    overdueAmount: 0,
    pendingCount: 0,
    revenueChange: 0,
    pendingChange: 0,
    paidThisMonthChange: 0,
    overdueChange: 0
  });
  const [userName, setUserName] = useState<string>('');
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDataPoint[]>([]);
  const [downloading, setDownloading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const downloadDashboard = useCallback(async () => {
    const node = dashboardRef.current;
    if (!node) return;
    try {
      setDownloading(true);
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(node).backgroundColor || '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(t('actions.dashboardDownloaded'));
    } catch (err) {
      toast.error(t('errors.downloadFailed'));
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }, [t]);

  const isUnauthenticatedError = (message?: string | null) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return normalized.includes('auth session missing') || normalized.includes('jwt');
  };

  // Navigation helper
  const navigateTo = (path: string, filter: string | null = null) => {
    if (filter) {
      router.push(`${path}?status=${filter}`);
    } else {
      router.push(path);
    }
  };

  // Data loading function
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (isUnauthenticatedError(authError.message)) {
          router.replace('/login');
          return;
        }

        setError(authError.message || t('errors.verifySession'));
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }

      const meta = authData.user?.user_metadata as Record<string, unknown> | undefined;
      setUserName(
        (meta?.full_name as string | undefined) ||
          (meta?.name as string | undefined) ||
          (authData.user?.email ? authData.user.email.split('@')[0] : '')
      );

      const [invoicesRes, clientsRes, expensesRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('clients').select('id').eq('user_id', userId),
        supabase.from('expenses').select('amount').eq('user_id', userId)
      ]);

      if (invoicesRes.error || clientsRes.error || expensesRes.error) {
        const message = invoicesRes.error?.message || clientsRes.error?.message || expensesRes.error?.message || t('errors.loadDashboardData');
        setError(message);
        return;
      }
      
      const invoices = invoicesRes.data || [];
      const clients = clientsRes.data || [];
      const expenses = expensesRes.data || [];
      
      const paidInvoices = invoices.filter((i: Invoice) => i.status === 'paid');
      const overdueInvoices = invoices.filter((i: Invoice) => 
        i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()
      );
      const pendingInvoices = invoices.filter((i: Invoice) => 
        i.status !== 'paid' && (!i.due_date || new Date(i.due_date) >= new Date())
      );
      
      const totalRevenue = paidInvoices.reduce((s: number, i: Invoice) => s + (i.total || 0), 0);
      const pendingAmount = pendingInvoices.reduce((s: number, i: Invoice) => s + (i.total || 0), 0);
      const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const overdueAmount = overdueInvoices.reduce((s: number, i: Invoice) => s + (i.total || 0), 0);

      // Month-over-month comparisons.
      const now2 = new Date();
      const thisMonthStart = startOfMonth(now2);
      const thisMonthEnd = endOfMonth(now2);
      const lastMonthDate = subMonths(now2, 1);
      const lastMonthStart = startOfMonth(lastMonthDate);
      const lastMonthEnd = endOfMonth(lastMonthDate);
      const inRange = (d: string, start: Date, end: Date) => {
        const dt = new Date(d);
        return dt >= start && dt <= end;
      };
      const pct = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };

      const paidThisMonth = paidInvoices
        .filter((i: Invoice) => inRange(i.created_at, thisMonthStart, thisMonthEnd))
        .reduce((s: number, i: Invoice) => s + (i.total || 0), 0);
      const paidLastMonth = paidInvoices
        .filter((i: Invoice) => inRange(i.created_at, lastMonthStart, lastMonthEnd))
        .reduce((s: number, i: Invoice) => s + (i.total || 0), 0);
      const revenueThisMonth = paidThisMonth;
      const pendingThisMonth = pendingInvoices.filter((i: Invoice) =>
        inRange(i.created_at, thisMonthStart, thisMonthEnd)
      ).length;
      const pendingLastMonth = pendingInvoices.filter((i: Invoice) =>
        inRange(i.created_at, lastMonthStart, lastMonthEnd)
      ).length;
      const overdueThisMonth = overdueInvoices
        .filter((i: Invoice) => inRange(i.created_at, thisMonthStart, thisMonthEnd))
        .reduce((s: number, i: Invoice) => s + (i.total || 0), 0);
      const overdueLastMonth = overdueInvoices
        .filter((i: Invoice) => inRange(i.created_at, lastMonthStart, lastMonthEnd))
        .reduce((s: number, i: Invoice) => s + (i.total || 0), 0);

      setStats({
        totalRevenue,
        netProfit: totalRevenue - totalExpenses,
        pendingAmount,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        totalClients: clients.length,
        totalExpenses,
        growth: 0,
        paidThisMonth,
        overdueAmount,
        pendingCount: pendingInvoices.length,
        revenueChange: pct(revenueThisMonth, paidLastMonth),
        pendingChange: pct(pendingThisMonth, pendingLastMonth),
        paidThisMonthChange: pct(paidThisMonth, paidLastMonth),
        overdueChange: pct(overdueThisMonth, overdueLastMonth)
      });
      
      setRecentInvoices(invoices.slice(0, 5));
      
      // Build chart data
      let chartData: RevenueDataPoint[] = [];
      const now = new Date();
      
      if (selectedPeriod === 'week') {
        for (let i = 6; i >= 0; i--) {
          const date = subDays(now, i);
          const dayInvoices = invoices.filter((inv: Invoice) => 
            format(new Date(inv.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
          );
          chartData.push({
            name: format(date, 'EEE'),
            revenue: dayInvoices.filter((i: Invoice) => i.status === 'paid').reduce((s: number, i: Invoice) => s + (i.total || 0), 0)
          });
        }
      } else if (selectedPeriod === 'month') {
        for (let i = 29; i >= 0; i -= 3) {
          const date = subDays(now, i);
          const dayInvoices = invoices.filter((inv: Invoice) => 
            format(new Date(inv.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
          );
          chartData.push({
            name: format(date, 'MMM dd'),
            revenue: dayInvoices.filter((i: Invoice) => i.status === 'paid').reduce((s: number, i: Invoice) => s + (i.total || 0), 0)
          });
        }
      } else {
        for (let i = 11; i >= 0; i--) {
          const date = subMonths(now, i);
          const monthInvoices = invoices.filter((inv: Invoice) => 
            new Date(inv.created_at) >= startOfMonth(date) && 
            new Date(inv.created_at) <= endOfMonth(date)
          );
          chartData.push({
            name: format(date, 'MMM'),
            revenue: monthInvoices.filter((i: Invoice) => i.status === 'paid').reduce((s: number, i: Invoice) => s + (i.total || 0), 0)
          });
        }
      }
      setRevenueData(chartData);
      
      setStatusData([
        { name: t('paid'), value: paidInvoices.length, color: '#10b981', link: '/dashboard/invoices?status=paid' },
        { name: t('pending'), value: pendingInvoices.length, color: '#f59e0b', link: '/dashboard/invoices?status=pending' },
        { name: t('overdue'), value: overdueInvoices.length, color: '#ef4444', link: '/dashboard/invoices?status=overdue' }
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.loadingData');
      setError(errorMessage);
      console.error(t('errors.loadingData'), err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Loading state
  if (loading) {
    return (
      <TooltipProvider>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-accent mx-auto mb-4"></div>
            <p className="text-text-secondary">{t('loading')}</p>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <TooltipProvider>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Card hoverGlow={false} className="text-center max-w-md">
            <div className="flex justify-center mb-4">
              <AlertTriangle size={44} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">{t('errors.loadingTitle')}</h2>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>{t('actions.tryAgain')}</Button>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  const hasData = stats.totalInvoices > 0 || stats.totalRevenue > 0;

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const kpiCards = [
    {
      label: t('kpi.totalRevenue'),
      value: stats.totalRevenue,
      prefix: '$',
      change: stats.revenueChange,
      Icon: DollarSign,
      iconClass: 'text-success bg-success/10',
      link: '/dashboard/invoices',
      filter: 'paid',
    },
    {
      label: t('kpi.pendingInvoices'),
      value: stats.pendingAmount,
      prefix: '$',
      change: stats.pendingChange,
      Icon: Clock,
      iconClass: 'text-yellow-400 bg-yellow-400/10',
      link: '/dashboard/invoices',
      filter: 'pending',
    },
    {
      label: t('kpi.paidThisMonth'),
      value: stats.paidThisMonth,
      prefix: '$',
      change: stats.paidThisMonthChange,
      Icon: CheckCircle2,
      iconClass: 'text-accent bg-accent/10',
      link: '/dashboard/invoices',
      filter: 'paid',
    },
    {
      label: t('kpi.overdueAmount'),
      value: stats.overdueAmount,
      prefix: '$',
      change: stats.overdueChange,
      Icon: AlertTriangle,
      iconClass: 'text-red-400 bg-red-400/10',
      link: '/dashboard/invoices',
      filter: 'overdue',
    },
  ];

  const statusBadgeVariant = (status?: string): 'success' | 'accent' | 'default' => {
    if (status === 'paid') return 'success';
    if (status === 'overdue') return 'default';
    return 'accent';
  };

  return (
    <TooltipProvider>
      <div ref={dashboardRef} className="min-h-screen bg-background text-text-primary">
        {/* Header section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
              {t(`greeting.${greetingKey}`)}
              {userName ? `, ${userName}` : ''} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-text-secondary">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2" data-html2canvas-ignore="true">
            <Button variant="secondary" loading={downloading} onClick={downloadDashboard}>
              {!downloading && <Download size={16} />}
              {downloading ? t('actions.downloadingDashboard') : t('actions.downloadDashboard')}
            </Button>
            <Button onClick={() => navigateTo('/dashboard/invoices/new')}>
              <Plus size={16} />
              {t('actions.createInvoice')}
            </Button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-6 inline-flex gap-1 rounded-button border border-border bg-surface p-1">
          {['week', 'month', 'year'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`rounded-button px-4 py-1.5 text-sm font-medium transition-all duration-250 ${
                selectedPeriod === period
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {t(`period.${period}`)}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.Icon;
            return (
              <Card
                key={kpi.label}
                onClick={() => navigateTo(kpi.link, kpi.filter)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-button p-2 ${kpi.iconClass}`}>
                    <Icon size={20} />
                  </div>
                  <ChangeIndicator change={kpi.change} />
                </div>
                <p className="mt-4 text-xs uppercase tracking-wide text-text-secondary">
                  {kpi.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-text-primary">
                  <AnimatedNumber value={kpi.value} prefix={kpi.prefix} />
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">{t('vsLastMonth')}</p>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Chart */}
        {hasData && (
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card hoverGlow={false}>
              <h2 className="mb-3 font-semibold text-text-primary">{t('revenueTrend')}</h2>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" stroke="#A1A1AA" fontSize={12} tickLine={false} />
                  <YAxis stroke="#A1A1AA" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1A1A1A',
                      border: '1px solid #2A2A2A',
                      borderRadius: 12,
                      color: '#FFFFFF',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fill="url(#revGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card hoverGlow={false}>
              <h2 className="mb-3 font-semibold text-text-primary">{t('invoiceStatus')}</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.color}
                        stroke="#1A1A1A"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigateTo(entry.link)}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1A1A1A',
                      border: '1px solid #2A2A2A',
                      borderRadius: 12,
                      color: '#FFFFFF',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: '#A1A1AA' }}
                    onClick={(e) => {
                      const item = statusData.find((d) => d.name === e.value);
                      if (item) navigateTo(item.link);
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Recent Invoices Table */}
        <Card hoverGlow={false} className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary">{t('recentInvoices')}</h2>
            <button
              onClick={() => navigateTo('/dashboard/invoices')}
              className="inline-flex items-center gap-1 text-sm text-accent transition-colors hover:text-accent-secondary"
            >
              {t('actions.viewAll')} <ArrowRight size={14} />
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Inbox size={28} className="text-accent" />
              </div>
              <p className="mb-1 font-medium text-text-primary">{t('noInvoicesYet')}</p>
              <p className="mb-4 max-w-xs text-sm text-text-secondary">{t('createFirstInvoice')}</p>
              <Button onClick={() => navigateTo('/dashboard/invoices/new')}>
                <Plus size={16} />
                {t('actions.createInvoice')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-6 py-3 font-medium">{t('invoice')}</th>
                    <th className="px-6 py-3 font-medium">{t('due')}</th>
                    <th className="px-6 py-3 font-medium text-right">{t('revenue')}</th>
                    <th className="px-6 py-3 font-medium text-right">{t('invoiceStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv, idx) => (
                    <tr
                      key={idx}
                      onClick={() => navigateTo(`/dashboard/invoices/${inv.id}`)}
                      className="cursor-pointer border-b border-border/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {inv.invoice_number || t('invoice')}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : t('notAvailable')}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-text-primary">
                        {inv.currency || 'USD'} {inv.total?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={statusBadgeVariant(inv.status)}>
                          {t(`status.${inv.status || 'draft'}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}
