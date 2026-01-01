'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface CategoryData {
  name: string
  value: number
  count: number
}

interface TrendData {
  period: string
  inflow: number
  outflow: number
  net: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function AnalyticsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('monthly')

  // Analytics data
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ inflows: CategoryData[], outflows: CategoryData[] }>({ inflows: [], outflows: [] })
  const [trends, setTrends] = useState<TrendData[]>([])
  const [metrics, setMetrics] = useState({
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
    avgMonthlyBurn: 0,
    topInflowCategory: '',
    topOutflowCategory: '',
    transactionCount: 0,
  })

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (companyId && startDate && endDate) {
      loadAnalytics()
    }
  }, [companyId, startDate, endDate, timeframe])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)

    // Get user's company_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }

    // Set default date range (last 6 months)
    const today = new Date()
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(today.getMonth() - 6)

    setEndDate(today.toISOString().split('T')[0])
    setStartDate(sixMonthsAgo.toISOString().split('T')[0])

    setLoading(false)
  }

  const loadAnalytics = async () => {
    // Get transactions
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true })

    if (error) {
      console.error('Error loading transactions:', error)
      return
    }

    const txns = data || []
    setTransactions(txns)

    // Calculate category breakdown
    const inflowsByCategory: { [key: string]: { value: number, count: number } } = {}
    const outflowsByCategory: { [key: string]: { value: number, count: number } } = {}

    txns.forEach(t => {
      if (t.type === 'Inflow') {
        if (!inflowsByCategory[t.category]) {
          inflowsByCategory[t.category] = { value: 0, count: 0 }
        }
        inflowsByCategory[t.category].value += t.amount
        inflowsByCategory[t.category].count += 1
      } else {
        if (!outflowsByCategory[t.category]) {
          outflowsByCategory[t.category] = { value: 0, count: 0 }
        }
        outflowsByCategory[t.category].value += t.amount
        outflowsByCategory[t.category].count += 1
      }
    })

    const inflowsData: CategoryData[] = Object.entries(inflowsByCategory).map(([name, data]) => ({
      name,
      value: Math.round(data.value),
      count: data.count,
    })).sort((a, b) => b.value - a.value)

    const outflowsData: CategoryData[] = Object.entries(outflowsByCategory).map(([name, data]) => ({
      name,
      value: Math.round(data.value),
      count: data.count,
    })).sort((a, b) => b.value - a.value)

    setCategoryBreakdown({ inflows: inflowsData, outflows: outflowsData })

    // Calculate trends
    const trendData = calculateTrends(txns, timeframe)
    setTrends(trendData)

    // Calculate metrics
    const totalInflow = txns.filter(t => t.type === 'Inflow').reduce((sum, t) => sum + t.amount, 0)
    const totalOutflow = txns.filter(t => t.type === 'Outflow').reduce((sum, t) => sum + t.amount, 0)
    const netCashFlow = totalInflow - totalOutflow

    const monthsDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    const avgMonthlyBurn = monthsDiff > 0 ? totalOutflow / monthsDiff : 0

    setMetrics({
      totalInflow: Math.round(totalInflow),
      totalOutflow: Math.round(totalOutflow),
      netCashFlow: Math.round(netCashFlow),
      avgMonthlyBurn: Math.round(avgMonthlyBurn),
      topInflowCategory: inflowsData[0]?.name || 'N/A',
      topOutflowCategory: outflowsData[0]?.name || 'N/A',
      transactionCount: txns.length,
    })
  }

  const calculateTrends = (txns: any[], timeframe: 'weekly' | 'monthly'): TrendData[] => {
    const grouped: { [key: string]: { inflow: number, outflow: number } } = {}

    txns.forEach(t => {
      const date = new Date(t.transaction_date)
      let period: string

      if (timeframe === 'weekly') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        period = weekStart.toISOString().split('T')[0]
      } else {
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      if (!grouped[period]) {
        grouped[period] = { inflow: 0, outflow: 0 }
      }

      if (t.type === 'Inflow') {
        grouped[period].inflow += t.amount
      } else {
        grouped[period].outflow += t.amount
      }
    })

    return Object.entries(grouped)
      .map(([period, data]) => ({
        period: timeframe === 'monthly' ? new Date(period + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : period,
        inflow: Math.round(data.inflow),
        outflow: Math.round(data.outflow),
        net: Math.round(data.inflow - data.outflow),
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Filters */}
      <Card className="mb-6">
          <CardHeader>
            <CardTitle>Analysis Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium block mb-2">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Timeframe</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as 'weekly' | 'monthly')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Inflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalInflow)}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Revenue streams
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Outflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(metrics.totalOutflow)}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingDown className="h-3 w-3 mr-1" />
                Operating expenses
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net Cash Flow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.netCashFlow)}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <DollarSign className="h-3 w-3 mr-1" />
                Period total
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Monthly Burn</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.avgMonthlyBurn)}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3 mr-1" />
                Per month
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Trends Chart */}
      <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cash Flow Trends</CardTitle>
            <CardDescription>{timeframe === 'weekly' ? 'Weekly' : 'Monthly'} inflows, outflows, and net cash flow</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="inflow" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Inflows" />
                <Area type="monotone" dataKey="outflow" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Outflows" />
                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={3} name="Net" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Inflow Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Inflow by Category</CardTitle>
              <CardDescription>Top revenue sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.inflows}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryBreakdown.inflows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {categoryBreakdown.inflows.slice(0, 5).map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span>{cat.name}</span>
                    </div>
                    <div className="font-semibold text-green-600">{formatCurrency(cat.value)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Outflow Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Outflow by Category</CardTitle>
              <CardDescription>Top expense categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.outflows}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryBreakdown.outflows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {categoryBreakdown.outflows.slice(0, 5).map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span>{cat.name}</span>
                    </div>
                    <div className="font-semibold text-red-600">{formatCurrency(cat.value)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Insights */}
      <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">Top Revenue Source</p>
                <p className="text-sm text-blue-700">
                  {metrics.topInflowCategory} is your largest revenue category, accounting for{' '}
                  {categoryBreakdown.inflows[0] ?
                    ((categoryBreakdown.inflows[0].value / metrics.totalInflow) * 100).toFixed(1) : 0}% of total inflows.
                </p>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-sm font-semibold text-orange-900">Top Expense Category</p>
                <p className="text-sm text-orange-700">
                  {metrics.topOutflowCategory} is your largest expense, representing{' '}
                  {categoryBreakdown.outflows[0] ?
                    ((categoryBreakdown.outflows[0].value / metrics.totalOutflow) * 100).toFixed(1) : 0}% of total outflows.
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                metrics.netCashFlow >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm font-semibold ${
                  metrics.netCashFlow >= 0 ? 'text-green-900' : 'text-red-900'
                }`}>
                  Net Cash Position
                </p>
                <p className={`text-sm ${
                  metrics.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {metrics.netCashFlow >= 0
                    ? `Positive cash flow of ${formatCurrency(metrics.netCashFlow)} for the period. Consider investing surplus cash.`
                    : `Negative cash flow of ${formatCurrency(Math.abs(metrics.netCashFlow))}. Review expenses and accelerate receivables.`
                  }
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-sm font-semibold text-purple-900">Transaction Volume</p>
                <p className="text-sm text-purple-700">
                  {metrics.transactionCount} transactions recorded in the selected period, averaging{' '}
                  {Math.round(metrics.transactionCount / ((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))} per month.
                </p>
              </div>
            </div>
          </CardContent>
      </Card>
    </div>
  )
}
