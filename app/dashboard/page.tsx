'use client';

import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n';
import { Tooltip, TooltipProvider } from '@/components/Tooltip';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

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
    growth: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDataPoint[]>([]);

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
      
      setStats({
        totalRevenue,
        netProfit: totalRevenue - totalExpenses,
        pendingAmount,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        totalClients: clients.length,
        totalExpenses,
        growth: 0
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
        { name: t('paid') || 'Paid', value: paidInvoices.length, color: '#10b981', link: '/dashboard/invoices?status=paid' },
        { name: t('pending') || 'Pending', value: pendingInvoices.length, color: '#f59e0b', link: '/dashboard/invoices?status=pending' },
        { name: t('overdue') || 'Overdue', value: overdueInvoices.length, color: '#ef4444', link: '/dashboard/invoices?status=overdue' }
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error loading dashboard data';
      setError(errorMessage);
      console.error('Error loading dashboard data:', err);
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
        <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-500">{t('loading') || 'Loading...'}</p>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <TooltipProvider>
        <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  const hasData = stats.totalInvoices > 0 || stats.totalRevenue > 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard') || 'Dashboard'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('welcomeBack') || 'Welcome back'}</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {['week', 'month', 'year'].map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                selectedPeriod === period 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-white dark:bg-gray-800 border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t(period) || period}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {!hasData ? (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 p-8 md:p-12 text-center mb-8">
            <div className="text-7xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('noInvoices') || 'No Invoices Yet'}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
              {t('createFirstInvoice') || 'Create your first invoice to start tracking revenue'}
            </p>
            <button 
              onClick={() => navigateTo('/dashboard/invoices/new')}
              className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-colors shadow-md"
            >
              + {t('createInvoice') || 'Create Invoice'}
            </button>
          </div>
        ) : (
          // Stats Cards
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Tooltip content={t('tooltips.totalRevenue')}>
              <div onClick={() => navigateTo('/dashboard/invoices', 'paid')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('revenue') || 'Revenue'}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">${stats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="text-2xl">💰</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.netProfit')}>
              <div onClick={() => navigateTo('/dashboard/reports')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('netProfit') || 'Net Profit'}</p>
                    <p className="text-xl font-bold text-green-600">${stats.netProfit.toLocaleString()}</p>
                  </div>
                  <div className="text-2xl">📈</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.pendingInvoices')}>
              <div onClick={() => navigateTo('/dashboard/invoices', 'pending')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('pending') || 'Pending'}</p>
                    <p className="text-xl font-bold text-yellow-600">${stats.pendingAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-2xl">⏳</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.allInvoices')}>
              <div onClick={() => navigateTo('/dashboard/invoices')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('totalInvoices') || 'Total Invoices'}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalInvoices}</p>
                  </div>
                  <div className="text-2xl">📄</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.paidInvoices')}>
              <div onClick={() => navigateTo('/dashboard/invoices', 'paid')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('paid') || 'Paid'}</p>
                    <p className="text-xl font-bold text-green-600">{stats.paidInvoices}</p>
                  </div>
                  <div className="text-2xl">✅</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.totalClients')}>
              <div onClick={() => navigateTo('/dashboard/clients')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('clients') || 'Clients'}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalClients}</p>
                  </div>
                  <div className="text-2xl">👥</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.overdueInvoices')}>
              <div onClick={() => navigateTo('/dashboard/invoices', 'overdue')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('overdue') || 'Overdue'}</p>
                    <p className="text-xl font-bold text-red-600">{stats.overdueInvoices}</p>
                  </div>
                  <div className="text-2xl">⚠️</div>
                </div>
              </div>
            </Tooltip>
            
            <Tooltip content={t('tooltips.totalExpenses')}>
              <div onClick={() => navigateTo('/dashboard/expenses')} className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{t('expenses') || 'Expenses'}</p>
                    <p className="text-xl font-bold text-red-600">${stats.totalExpenses.toLocaleString()}</p>
                  </div>
                  <div className="text-2xl">💰</div>
                </div>
              </div>
            </Tooltip>
          </div>
        )}

        {/* Charts */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
              <h2 className="font-bold mb-3">{t('revenueTrend') || 'Revenue Trend'}</h2>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
              <h2 className="font-bold mb-3">{t('invoiceStatus') || 'Invoice Status'}</h2>
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
                        style={{ cursor: 'pointer' }} 
                        onClick={() => navigateTo(entry.link)} 
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend onClick={(e) => {
                    const item = statusData.find(d => d.name === e.value);
                    if (item) navigateTo(item.link);
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Invoices */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">{t('recentInvoices') || 'Recent Invoices'}</h2>
            <button onClick={() => navigateTo('/dashboard/invoices')} className="text-purple-600 text-sm hover:text-purple-700 transition-colors">
              {t('viewAll') || 'View All'} →
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-gray-500">{t('noInvoices') || 'No invoices yet'}</p>
              <button 
                onClick={() => navigateTo('/dashboard/invoices/new')}
                className="mt-2 text-purple-600 hover:text-purple-700 text-sm"
              >
                {t('createFirstInvoice') || 'Create your first invoice'} →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigateTo(`/dashboard/invoices/${inv.id}`)} 
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${inv.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>
                      {inv.status === 'paid' ? '✅' : '📄'}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{inv.invoice_number || 'Invoice'}</p>
                      <p className="text-xs text-gray-500">{t('due') || 'Due'}: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">{inv.currency || 'USD'} {inv.total?.toFixed(2) || '0.00'}</p>
                    <p className={`text-xs font-medium ${inv.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>
                      {t(inv.status || 'draft') || inv.status || 'Draft'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
