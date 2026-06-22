'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  differenceInDays,
  startOfQuarter,
  startOfYear,
} from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildTimeReport, formatMinutesAsHoursMinutes, type TimeEntryRecord } from '@/lib/timeTracking';

type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'draft' | 'sent' | string;
type Period = 'month' | 'quarter' | 'year';

interface Invoice {
  id: string;
  client_id?: string | null;
  total: number;
  status: InvoiceStatus;
  due_date?: string | null;
  created_at: string;
  paid_at?: string | null;
  clients?: { name?: string } | null;
}

interface Expense {
  id: string;
  amount: number;
  category?: string | null;
  date: string;
}

interface Client {
  id: string;
  name: string;
}

interface Summary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  clientCount: number;
  averageInvoiceValue: number;
}

interface ReportsData {
  summary: Summary;
  timeSummary: {
    totalMinutes: number;
    billableMinutes: number;
    nonBillableMinutes: number;
    linkedInvoiceCount: number;
  };
  revenueByClient: { name: string; value: number }[];
  revenueByStatus: { name: string; value: number; color: string }[];
  expensesByCategory: { name: string; value: number }[];
  expenseTrend: { period: string; value: number }[];
  profitTrend: { period: string; revenue: number; expenses: number; profit: number }[];
  topClients: { name: string; revenue: number; invoices: number }[];
  clientPaymentHistory: { client: string; paid: number; pending: number; overdue: number }[];
  clientAging: { client: string; current: number; d30: number; d60: number; d90: number }[];
  invoiceAging: { bucket: string; value: number }[];
  invoiceVolumeTrend: { period: string; invoices: number }[];
  timeByClient: { name: string; value: number }[];
  timeTrend: { period: string; value: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  paid: '#16a34a',
  pending: '#f59e0b',
  overdue: '#dc2626',
  draft: '#6b7280',
  sent: '#2563eb',
};

function toNumber(value: unknown): number {
  return Number(value || 0);
}

function safeDate(input?: string | null): Date | null {
  if (!input) return null;
  try {
    return parseISO(input);
  } catch {
    return null;
  }
}

function inRange(date: Date | null, startDate: Date, endDate: Date): boolean {
  if (!date) return false;
  return isWithinInterval(date, { start: startDate, end: endDate });
}

function bucketMonth(date: Date) {
  return format(date, 'MMM yyyy');
}

function aggregateByPeriod(items: { date: Date; revenue?: number; expenses?: number; invoices?: number }[]) {
  const map = new Map<string, { revenue: number; expenses: number; invoices: number }>();
  items.forEach((item) => {
    const key = bucketMonth(item.date);
    const prev = map.get(key) || { revenue: 0, expenses: 0, invoices: 0 };
    map.set(key, {
      revenue: prev.revenue + toNumber(item.revenue),
      expenses: prev.expenses + toNumber(item.expenses),
      invoices: prev.invoices + toNumber(item.invoices),
    });
  });
  return Array.from(map.entries()).map(([period, v]) => ({ period, ...v }));
}

export default function ReportsPage() {
  const t = useTranslations('reportsPage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insights, setInsights] = useState<string>('');
  const cacheRef = useRef<Record<string, ReportsData>>({});

  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);

  const currency = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }), []);

  const rangeDates = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return { start, end };
  }, [startDate, endDate]);

  const loadReports = useCallback(async () => {
    const cacheKey = `${startDate}_${endDate}_${period}`;
    if (cacheRef.current[cacheKey]) {
      setReportsData(cacheRef.current[cacheKey]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        setError(t('errors.supabaseInit'));
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setError(t('errors.loginRequired'));
        return;
      }

      const [invoiceRes, expenseRes, clientsRes, timeRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id,client_id,total,status,due_date,created_at,paid_at,clients(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('id,amount,category,date')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        supabase.from('clients').select('id,name').eq('user_id', user.id),
        supabase
          .from('time_entries')
          .select('id,client_id,invoice_id,duration_minutes,billable,entry_date,clients(name)')
          .eq('user_id', user.id)
          .order('entry_date', { ascending: false }),
      ]);

      if (invoiceRes.error) {
        setError(invoiceRes.error.message);
        return;
      }
      if (expenseRes.error) {
        setError(expenseRes.error.message);
        return;
      }
      if (clientsRes.error) {
        setError(clientsRes.error.message);
        return;
      }
      if (timeRes.error) {
        setError(timeRes.error.message);
        return;
      }

      const invoices = (invoiceRes.data || []) as Invoice[];
      const expenses = (expenseRes.data || []) as Expense[];
      const clients = (clientsRes.data || []) as Client[];
      const timeEntries = (timeRes.data || []) as TimeEntryRecord[];

      const filteredInvoices = invoices.filter((inv) => inRange(safeDate(inv.created_at), rangeDates.start, rangeDates.end));
      const filteredExpenses = expenses.filter((exp) => inRange(safeDate(exp.date), rangeDates.start, rangeDates.end));
      const filteredTimeEntries = timeEntries.filter((entry) => inRange(safeDate(entry.entry_date), rangeDates.start, rangeDates.end));
      const timeSummary = buildTimeReport(filteredTimeEntries);

      const totalRevenue = filteredInvoices
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + toNumber(inv.total), 0);
      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + toNumber(exp.amount), 0);
      const netProfit = totalRevenue - totalExpenses;
      const averageInvoiceValue = filteredInvoices.length
        ? filteredInvoices.reduce((sum, inv) => sum + toNumber(inv.total), 0) / filteredInvoices.length
        : 0;

      const revenueByClientMap = new Map<string, number>();
      filteredInvoices
        .filter((inv) => inv.status === 'paid')
        .forEach((inv) => {
          const name = inv.clients?.name || `Client ${inv.client_id?.slice(0, 6) || 'Unknown'}`;
          revenueByClientMap.set(name, (revenueByClientMap.get(name) || 0) + toNumber(inv.total));
        });

      const revenueByStatus = Object.entries(
        filteredInvoices.reduce<Record<string, number>>((acc, inv) => {
          acc[inv.status] = (acc[inv.status] || 0) + toNumber(inv.total);
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#334155' }));

      const expensesByCategory = Object.entries(
        filteredExpenses.reduce<Record<string, number>>((acc, exp) => {
          const key = exp.category || 'Uncategorized';
          acc[key] = (acc[key] || 0) + toNumber(exp.amount);
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value }));

      const expenseTrendBase = aggregateByPeriod(
        filteredExpenses
          .map((exp) => ({ date: safeDate(exp.date), expenses: toNumber(exp.amount) }))
          .filter((item): item is { date: Date; expenses: number } => Boolean(item.date)),
      );

      const profitTrendBase = aggregateByPeriod([
        ...filteredInvoices
          .map((inv) => ({
            date: safeDate(inv.created_at),
            revenue: inv.status === 'paid' ? toNumber(inv.total) : 0,
            invoices: 1,
          }))
          .filter((item): item is { date: Date; revenue: number; invoices: number } => Boolean(item.date)),
        ...filteredExpenses
          .map((exp) => ({ date: safeDate(exp.date), expenses: toNumber(exp.amount) }))
          .filter((item): item is { date: Date; expenses: number } => Boolean(item.date)),
      ]);

      const topClientsMap = new Map<string, { revenue: number; invoices: number }>();
      filteredInvoices.forEach((inv) => {
        const clientName = inv.clients?.name || `Client ${inv.client_id?.slice(0, 6) || 'Unknown'}`;
        const prev = topClientsMap.get(clientName) || { revenue: 0, invoices: 0 };
        topClientsMap.set(clientName, {
          revenue: prev.revenue + (inv.status === 'paid' ? toNumber(inv.total) : 0),
          invoices: prev.invoices + 1,
        });
      });

      const clientPaymentHistory = Array.from(topClientsMap.entries()).map(([client, stats]) => {
        const invoicesForClient = filteredInvoices.filter((inv) => (inv.clients?.name || '').trim() === client.trim());
        return {
          client,
          paid: invoicesForClient.filter((i) => i.status === 'paid').length,
          pending: invoicesForClient.filter((i) => i.status === 'pending' || i.status === 'sent').length,
          overdue: invoicesForClient.filter((i) => i.status === 'overdue').length,
          revenue: stats.revenue,
        };
      });

      const now = new Date();
      const agingForInvoice = (inv: Invoice) => {
        const due = safeDate(inv.due_date || null);
        if (!due || inv.status === 'paid') return 'current';
        const days = Math.max(0, differenceInDays(now, due));
        if (days >= 90) return 'd90';
        if (days >= 60) return 'd60';
        if (days >= 30) return 'd30';
        return 'current';
      };

      const invoiceAgingMap = { d30: 0, d60: 0, d90: 0, current: 0 };
      filteredInvoices.forEach((inv) => {
        const bucket = agingForInvoice(inv);
        invoiceAgingMap[bucket as keyof typeof invoiceAgingMap] += toNumber(inv.total);
      });

      const clientAgingMap = new Map<string, { current: number; d30: number; d60: number; d90: number }>();
      filteredInvoices.forEach((inv) => {
        const client = inv.clients?.name || `Client ${inv.client_id?.slice(0, 6) || 'Unknown'}`;
        const prev = clientAgingMap.get(client) || { current: 0, d30: 0, d60: 0, d90: 0 };
        const bucket = agingForInvoice(inv);
        prev[bucket as keyof typeof prev] += toNumber(inv.total);
        clientAgingMap.set(client, prev);
      });

      const data: ReportsData = {
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          invoiceCount: filteredInvoices.length,
          clientCount: clients.length,
          averageInvoiceValue,
        },
        timeSummary: {
          totalMinutes: timeSummary.totalMinutes,
          billableMinutes: timeSummary.billableMinutes,
          nonBillableMinutes: timeSummary.nonBillableMinutes,
          linkedInvoiceCount: timeSummary.linkedInvoiceCount,
        },
        revenueByClient: Array.from(revenueByClientMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8),
        revenueByStatus,
        expensesByCategory,
        expenseTrend: expenseTrendBase.map((entry) => ({ period: entry.period, value: entry.expenses })),
        profitTrend: profitTrendBase.map((entry) => ({
          period: entry.period,
          revenue: entry.revenue,
          expenses: entry.expenses,
          profit: entry.revenue - entry.expenses,
        })),
        topClients: Array.from(topClientsMap.entries())
          .map(([name, stats]) => ({ name, revenue: stats.revenue, invoices: stats.invoices }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        clientPaymentHistory: clientPaymentHistory
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8)
          .map(({ revenue: _revenue, ...rest }) => rest),
        clientAging: Array.from(clientAgingMap.entries())
          .map(([client, aging]) => ({ client, ...aging }))
          .sort((a, b) => b.d90 + b.d60 + b.d30 - (a.d90 + a.d60 + a.d30))
          .slice(0, 8),
        invoiceAging: [
          { bucket: 'Current', value: invoiceAgingMap.current },
          { bucket: '30+ Days', value: invoiceAgingMap.d30 },
          { bucket: '60+ Days', value: invoiceAgingMap.d60 },
          { bucket: '90+ Days', value: invoiceAgingMap.d90 },
        ],
        invoiceVolumeTrend: profitTrendBase.map((entry) => ({ period: entry.period, invoices: entry.invoices })),
        timeByClient: timeSummary.byClient.map((item) => ({ name: item.name, value: item.minutes })).slice(0, 8),
        timeTrend: timeSummary.byDay.map((item) => ({ period: item.date, value: item.minutes })),
      };

      cacheRef.current[cacheKey] = data;
      setReportsData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.loadFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [endDate, period, rangeDates.end, rangeDates.start, startDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const exportCSV = useCallback(() => {
    if (!reportsData) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue', reportsData.summary.totalRevenue.toFixed(2)],
      ['Total Expenses', reportsData.summary.totalExpenses.toFixed(2)],
      ['Net Profit', reportsData.summary.netProfit.toFixed(2)],
      ['Tracked Time', formatMinutesAsHoursMinutes(reportsData.timeSummary.totalMinutes)],
      ['Billable Time', formatMinutesAsHoursMinutes(reportsData.timeSummary.billableMinutes)],
      ['Average Invoice Value', reportsData.summary.averageInvoiceValue.toFixed(2)],
      ['Invoices', String(reportsData.summary.invoiceCount)],
      ['Clients', String(reportsData.summary.clientCount)],
      [],
      ['Top Clients', 'Revenue'],
      ...reportsData.topClients.map((c) => [c.name, c.revenue.toFixed(2)]),
    ];

    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reports_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [reportsData]);

  const exportPDF = useCallback(() => {
    if (!reportsData) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Reports Export</title><style>
      body{font-family:Arial,sans-serif;padding:24px;} h1{margin-bottom:4px;} table{width:100%;border-collapse:collapse;margin-top:16px}
      td,th{border:1px solid #ddd;padding:8px;text-align:left}
      </style></head><body>
      <h1>Financial Reports</h1>
      <p>${startDate} to ${endDate}</p>
      <table><tbody>
      <tr><th>Total Revenue</th><td>${currency.format(reportsData.summary.totalRevenue)}</td></tr>
      <tr><th>Total Expenses</th><td>${currency.format(reportsData.summary.totalExpenses)}</td></tr>
      <tr><th>Net Profit</th><td>${currency.format(reportsData.summary.netProfit)}</td></tr>
      <tr><th>Tracked Time</th><td>${formatMinutesAsHoursMinutes(reportsData.timeSummary.totalMinutes)}</td></tr>
      <tr><th>Billable Time</th><td>${formatMinutesAsHoursMinutes(reportsData.timeSummary.billableMinutes)}</td></tr>
      <tr><th>Average Invoice Value</th><td>${currency.format(reportsData.summary.averageInvoiceValue)}</td></tr>
      </tbody></table>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }, [currency, endDate, reportsData, startDate]);

  const generateInsights = useCallback(async () => {
    if (!reportsData) return;
    try {
      setInsightsLoading(true);
      setInsightsError(null);
      const res = await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'Analyze business reports and provide key metrics, anomalies, and recommendations',
          payload: {
            dateRange: { startDate, endDate },
            period,
            summary: reportsData.summary,
            revenueByStatus: reportsData.revenueByStatus,
            expenseByCategory: reportsData.expensesByCategory,
            profitTrend: reportsData.profitTrend,
            invoiceAging: reportsData.invoiceAging,
            topClients: reportsData.topClients,
          },
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || t('errors.insightsFailed'));
      }
      setInsights(payload?.response || 'No insights returned.');
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : t('errors.insightsFailed'));
    } finally {
      setInsightsLoading(false);
    }
  }, [endDate, period, reportsData, startDate]);

  const applyPresetPeriod = (value: Period) => {
    const now = new Date();
    setPeriod(value);
    if (value === 'month') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
      return;
    }
    if (value === 'quarter') {
      setStartDate(format(startOfQuarter(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      return;
    }
    setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
    setEndDate(format(now, 'yyyy-MM-dd'));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t('errorPrefix')}: {error}</p>
          <button onClick={loadReports} className="mt-2 text-sm text-blue-600 hover:underline">
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (!reportsData) return null;

  return (
    <div className="container mx-auto p-4 space-y-8" id="reports-content">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyPresetPeriod('month')} className="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800">{t('period.month')}</button>
          <button onClick={() => applyPresetPeriod('quarter')} className="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800">{t('period.quarter')}</button>
          <button onClick={() => applyPresetPeriod('year')} className="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800">{t('period.year')}</button>
          <button onClick={exportCSV} className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white">{t('export.csv')}</button>
          <button onClick={exportPDF} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white">{t('export.pdf')}</button>
          <button onClick={() => window.print()} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white">{t('export.print')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.totalRevenue')}</p><p className="text-lg font-bold text-green-600">{currency.format(reportsData.summary.totalRevenue)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.totalExpenses')}</p><p className="text-lg font-bold text-red-600">{currency.format(reportsData.summary.totalExpenses)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.netProfit')}</p><p className="text-lg font-bold text-blue-600">{currency.format(reportsData.summary.netProfit)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.invoices')}</p><p className="text-lg font-bold">{reportsData.summary.invoiceCount}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.clients')}</p><p className="text-lg font-bold">{reportsData.summary.clientCount}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.avgInvoice')}</p><p className="text-lg font-bold">{currency.format(reportsData.summary.averageInvoiceValue)}</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.trackedTime')}</p><p className="text-lg font-bold">{formatMinutesAsHoursMinutes(reportsData.timeSummary.totalMinutes)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.billableTime')}</p><p className="text-lg font-bold text-green-600">{formatMinutesAsHoursMinutes(reportsData.timeSummary.billableMinutes)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.nonBillableTime')}</p><p className="text-lg font-bold">{formatMinutesAsHoursMinutes(reportsData.timeSummary.nonBillableMinutes)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('stats.linkedInvoices')}</p><p className="text-lg font-bold">{reportsData.timeSummary.linkedInvoiceCount}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.revenueByClient')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportsData.revenueByClient}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#16a34a" /></BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.revenueByStatus')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={reportsData.revenueByStatus} dataKey="value" nameKey="name" outerRadius={110}>
                  {reportsData.revenueByStatus.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.expensesByCategory')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportsData.expensesByCategory}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#dc2626" /></BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.expenseTrends')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsData.expenseTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:col-span-2">
          <h2 className="font-semibold mb-4">{t('charts.profitLoss')}</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsData.profitTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend /><Line dataKey="revenue" stroke="#16a34a" /><Line dataKey="expenses" stroke="#dc2626" /><Line dataKey="profit" stroke="#2563eb" strokeWidth={3} /></LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.timeByClient')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportsData.timeByClient}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#0ea5e9" /></BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.trackedTimeTrend')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsData.timeTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">{t('charts.topClients')}</h2>
          <div className="space-y-2">{reportsData.topClients.map((client) => <div key={client.name} className="flex justify-between text-sm"><span>{client.name}</span><span>{currency.format(client.revenue)}</span></div>)}</div>
        </section>
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">{t('charts.clientPaymentHistory')}</h2>
          <div className="space-y-2">{reportsData.clientPaymentHistory.map((row) => <div key={row.client} className="text-sm"><p className="font-medium">{row.client}</p><p className="text-gray-500">{t('clientHistory.paid')}: {row.paid} · {t('clientHistory.pending')}: {row.pending} · {t('clientHistory.overdue')}: {row.overdue}</p></div>)}</div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.clientAging')}</h2>
          <div className="space-y-2">{reportsData.clientAging.map((row) => <div key={row.client} className="text-sm flex justify-between"><span>{row.client}</span><span>30: {currency.format(row.d30)} · 60: {currency.format(row.d60)} · 90+: {currency.format(row.d90)}</span></div>)}</div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.invoiceAging')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportsData.invoiceAging}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bucket" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#f59e0b" /></BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.invoiceVolume')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsData.invoiceVolumeTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Line type="monotone" dataKey="invoices" stroke="#7c3aed" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t('charts.aiInsights')}</h2>
          <button onClick={generateInsights} disabled={insightsLoading} className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-70">
            {insightsLoading ? t('ai.generating') : t('ai.generate')}
          </button>
          {insightsError && <p className="text-sm text-red-500 mt-3">{insightsError}</p>}
          {insights && <pre className="mt-3 whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded">{insights}</pre>}
        </section>
      </div>
    </div>
  );
}