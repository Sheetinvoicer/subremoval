'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { 
  DollarSign, 
  Users, 
  FileText, 
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import CustomizableDashboard from '@/components/CustomizableDashboard'

const RevenueChart = dynamic(() => import('@/components/RevenueChart'), { ssr: false })
const InvoiceChart = dynamic(() => import('@/components/InvoiceChart'), { ssr: false })
const ValueTrendChart = dynamic(() => import('@/components/ValueTrendChart'), { ssr: false })

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalClients: 0,
    revenue: 0,
    pendingAmount: 0
  })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentActivities, setRecentActivities] = useState([])
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadAllData()
  }, [])

  const loadAllData = async () => {
    await Promise.all([
      loadStats(),
      loadRecentInvoices(),
      loadRecentActivities()
    ])
  }

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { count: invoiceCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      const { data: paidInvoices } = await supabase.from('invoices').select('total').eq('user_id', user.id).eq('status', 'paid')
      const revenue = paidInvoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0
      const { data: pendingInvoices } = await supabase.from('invoices').select('total').eq('user_id', user.id).in('status', ['draft', 'sent'])
      const pendingAmount = pendingInvoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0
      setStats({ totalInvoices: invoiceCount || 0, totalClients: clientCount || 0, revenue, pendingAmount })
    }
  }

  const loadRecentInvoices = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('invoices')
        .select('*, clients(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentInvoices(data || [])
    }
  }

  const loadRecentActivities = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('invoices')
        .select('*, clients(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      const formatted = data?.map(activity => ({
        id: activity.id,
        type: activity.status === 'paid' ? 'payment' : 'invoice',
        description: `${activity.status === 'paid' ? 'Payment received' : 'Invoice created'} for ${activity.clients?.name}`,
        amount: activity.total,
        date: activity.created_at,
      })) || []
      setRecentActivities(formatted)
    }
  }

  const chartData = [
    { month: 'Jan', revenue: 4200, invoices: 8 },
    { month: 'Feb', revenue: 3800, invoices: 6 },
    { month: 'Mar', revenue: 5100, invoices: 10 },
    { month: 'Apr', revenue: 4700, invoices: 9 },
    { month: 'May', revenue: 5800, invoices: 12 },
    { month: 'Jun', revenue: 6200, invoices: 14 }
  ]

  const StatCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Link href="/dashboard/invoices" className="block group">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-100">Total Invoices</p>
              <p className="text-2xl font-bold">{stats.totalInvoices}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-200" />
          </div>
          <div className="flex items-center gap-1 mt-2 text-blue-100 text-xs">
            <TrendingUp className="w-3 h-3" />
            <span>+12% from last month</span>
          </div>
        </div>
      </Link>
      <Link href="/dashboard/clients" className="block group">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100">Total Clients</p>
              <p className="text-2xl font-bold">{stats.totalClients}</p>
            </div>
            <Users className="w-8 h-8 text-green-200" />
          </div>
          <div className="flex items-center gap-1 mt-2 text-green-100 text-xs">
            <TrendingUp className="w-3 h-3" />
            <span>+8% from last month</span>
          </div>
        </div>
      </Link>
      <Link href="/dashboard/invoices?status=paid" className="block group">
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-100">Total Revenue</p>
              <p className="text-2xl font-bold">${stats.revenue.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-200" />
          </div>
          <div className="flex items-center gap-1 mt-2 text-yellow-100 text-xs">
            <TrendingUp className="w-3 h-3" />
            <span>+15% from last month</span>
          </div>
        </div>
      </Link>
      <Link href="/dashboard/invoices?status=draft" className="block group">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-100">Pending Amount</p>
              <p className="text-2xl font-bold">${stats.pendingAmount.toLocaleString()}</p>
            </div>
            <Clock className="w-8 h-8 text-red-200" />
          </div>
          <div className="flex items-center gap-1 mt-2 text-red-100 text-xs">
            <TrendingDown className="w-3 h-3" />
            <span>-5% from last month</span>
          </div>
        </div>
      </Link>
    </div>
  )

  const RevenueChartComponent = () => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Revenue Trend</h3>
      <div className="h-64">
        <RevenueChart data={chartData} />
      </div>
    </div>
  )

  const InvoiceChartComponent = () => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Invoice Volume</h3>
      <div className="h-64">
        <InvoiceChart data={chartData} />
      </div>
    </div>
  )

  const ValueChartComponent = () => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Average Invoice Value</h3>
      <div className="h-64">
        <ValueTrendChart data={chartData} />
      </div>
    </div>
  )

  // RECENT INVOICES - NOW CLICKABLE with hover effect
  const RecentInvoicesComponent = () => (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Invoices</h3>
        <Link href="/dashboard/invoices" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {recentInvoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No invoices yet</div>
        ) : (
          recentInvoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/dashboard/invoices/${invoice.id}`}
              className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer hover:shadow-md"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{invoice.clients?.name}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">${invoice.total?.toLocaleString()}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )

  // RECENT ACTIVITIES - NOW CLICKABLE with hover effect
  const ActivitiesComponent = () => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Activities</h3>
      <div className="space-y-2">
        {recentActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No recent activities</div>
        ) : (
          recentActivities.map((activity) => (
            <Link
              key={activity.id}
              href={`/dashboard/invoices/${activity.id}`}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer hover:shadow-md"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activity.type === 'payment' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                {activity.type === 'payment' ? (
                  <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">{activity.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(activity.date).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )

  const QuickActionsComponent = () => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/dashboard/invoices/new" className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 text-sm hover:bg-blue-100 transition-colors">
          New Invoice
        </Link>
        <Link href="/dashboard/clients" className="text-center p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 text-sm hover:bg-green-100 transition-colors">
          Add Client
        </Link>
      </div>
    </div>
  )

  const widgetContent = {
    stats: <StatCards />,
    revenueChart: <RevenueChartComponent />,
    invoiceChart: <InvoiceChartComponent />,
    valueChart: <ValueChartComponent />,
    recentInvoices: <RecentInvoicesComponent />,
    activities: <ActivitiesComponent />,
    quickActions: <QuickActionsComponent />,
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back, {user?.email?.split('@')[0]}! 👋</p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <CustomizableDashboard widgetContent={widgetContent} />
    </div>
  )
}
