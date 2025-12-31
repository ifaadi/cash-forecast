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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ComparisonData {
  week: string
  weekNumber: number
  forecasted: number
  actual: number
  variance: number
  variancePct: number
}

export default function ActualsVsForecastPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accuracyScore, setAccuracyScore] = useState(0)
  const [avgVariance, setAvgVariance] = useState(0)
  const [avgVariancePct, setAvgVariancePct] = useState(0)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (companyId && startDate && endDate) {
      loadComparison()
    }
  }, [companyId, startDate, endDate])

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

    // Set default date range (last 13 weeks)
    const today = new Date()
    const thirteenWeeksAgo = new Date(today)
    thirteenWeeksAgo.setDate(today.getDate() - 91) // 13 weeks = 91 days

    setEndDate(today.toISOString().split('T')[0])
    setStartDate(thirteenWeeksAgo.toISOString().split('T')[0])

    setLoading(false)
  }

  const loadComparison = async () => {
    // Get actual transactions
    const { data: transactions, error } = await supabase
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

    // Generate comparison data (forecast vs actuals)
    const comparison = generateComparison(transactions || [], startDate, endDate)
    setComparisonData(comparison)

    // Calculate metrics
    if (comparison.length > 0) {
      const totalVariance = comparison.reduce((sum, d) => sum + Math.abs(d.variance), 0)
      const avgVar = totalVariance / comparison.length
      const avgVarPct = comparison.reduce((sum, d) => sum + Math.abs(d.variancePct), 0) / comparison.length
      const accuracy = Math.max(0, 100 - avgVarPct)

      setAvgVariance(avgVar)
      setAvgVariancePct(avgVarPct)
      setAccuracyScore(accuracy)
    }
  }

  const generateComparison = (transactions: any[], start: string, end: string): ComparisonData[] => {
    const startD = new Date(start)
    const endD = new Date(end)
    const weeks: ComparisonData[] = []

    let weekNum = 1
    let currentWeekStart = new Date(startD)

    while (currentWeekStart <= endD) {
      const currentWeekEnd = new Date(currentWeekStart)
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6)

      // Get actual transactions for this week
      const weekTransactions = transactions.filter(t => {
        const tDate = new Date(t.transaction_date)
        return tDate >= currentWeekStart && tDate <= currentWeekEnd
      })

      const actualInflow = weekTransactions
        .filter(t => t.type === 'Inflow')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualOutflow = weekTransactions
        .filter(t => t.type === 'Outflow')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualNet = actualInflow - actualOutflow

      // Generate forecasted value (mock for now - in production, use saved forecasts)
      const forecastedNet = generateMockForecast(weekNum)

      const variance = actualNet - forecastedNet
      const variancePct = forecastedNet !== 0 ? (variance / Math.abs(forecastedNet)) * 100 : 0

      weeks.push({
        week: `W${weekNum} (${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        weekNumber: weekNum,
        forecasted: Math.round(forecastedNet),
        actual: Math.round(actualNet),
        variance: Math.round(variance),
        variancePct: Math.round(variancePct * 10) / 10,
      })

      currentWeekStart = new Date(currentWeekEnd)
      currentWeekStart.setDate(currentWeekEnd.getDate() + 1)
      weekNum++

      // Limit to reasonable number of weeks
      if (weekNum > 52) break
    }

    return weeks
  }

  const generateMockForecast = (weekNum: number): number => {
    // Mock forecasted values (in production, load from saved forecasts)
    const baseInflow = 900000 // $900K inflow
    const baseOutflow = weekNum % 2 === 0 ? 1000000 : 400000 // $1M or $400K outflow
    return baseInflow - baseOutflow
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📊 Actuals vs Forecast</h1>
              <p className="text-sm text-gray-600">Track forecast accuracy and learn from variances</p>
            </div>
          </div>
          {/* Navigation */}
          <nav className="flex gap-4 border-t pt-4">
            <Button onClick={() => router.push('/dashboard')} variant="outline" size="sm">
              Dashboard
            </Button>
            <Button onClick={() => router.push('/transactions')} variant="outline" size="sm">
              Transactions
            </Button>
            <Button onClick={() => router.push('/actuals-vs-forecast')} variant="default" size="sm">
              Actuals vs Forecast
            </Button>
            <Button onClick={() => router.push('/chat')} variant="outline" size="sm">
              Ask CFO
            </Button>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Range Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Date Range</CardTitle>
            <CardDescription>Compare forecast accuracy over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </CardContent>
        </Card>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Forecast Accuracy Score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${
                accuracyScore >= 90 ? 'text-green-600' :
                accuracyScore >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round(accuracyScore)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {accuracyScore >= 90 ? 'Excellent' : accuracyScore >= 70 ? 'Good' : 'Needs Improvement'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Variance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{formatCurrency(avgVariance)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per week on average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Variance %</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{avgVariancePct.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Deviation from forecast</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Forecast vs Actual Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Forecast vs Actual Net Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="forecasted" stroke="#3b82f6" strokeWidth={2} name="Forecasted" />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} name="Actual" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Variance Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Variance by Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="variance" fill="#f59e0b" name="Variance ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Breakdown</CardTitle>
            <CardDescription>Detailed variance analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Week</th>
                    <th className="text-right py-3 px-4">Forecasted</th>
                    <th className="text-right py-3 px-4">Actual</th>
                    <th className="text-right py-3 px-4">Variance ($)</th>
                    <th className="text-right py-3 px-4">Variance (%)</th>
                    <th className="text-center py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        No data available for the selected date range. Add transactions to see comparison.
                      </td>
                    </tr>
                  ) : (
                    comparisonData.map((row) => (
                      <tr key={row.weekNumber} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{row.week}</td>
                        <td className="py-3 px-4 text-right font-medium text-blue-600">
                          {formatCurrency(row.forecasted)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-green-600">
                          {formatCurrency(row.actual)}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${
                          row.variance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {row.variance >= 0 ? '+' : ''}{formatCurrency(row.variance)}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${
                          Math.abs(row.variancePct) <= 10 ? 'text-green-600' :
                          Math.abs(row.variancePct) <= 20 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {row.variancePct >= 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          {Math.abs(row.variancePct) <= 10 ? (
                            <TrendingUp className="h-5 w-5 text-green-600 inline" />
                          ) : Math.abs(row.variancePct) <= 20 ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-600 inline" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600 inline" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        {comparisonData.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {accuracyScore >= 90 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-green-900">Excellent Forecasting</p>
                    <p className="text-sm text-green-700">
                      Your forecasts are highly accurate with an average variance of just {avgVariancePct.toFixed(1)}%.
                      Continue using the same forecasting methodology.
                    </p>
                  </div>
                )}

                {accuracyScore >= 70 && accuracyScore < 90 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm font-semibold text-yellow-900">Good Forecasting</p>
                    <p className="text-sm text-yellow-700">
                      Your forecasts show good accuracy at {accuracyScore.toFixed(0)}%. Review weeks with larger variances
                      to identify patterns and improve accuracy.
                    </p>
                  </div>
                )}

                {accuracyScore < 70 && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm font-semibold text-red-900">Forecasting Needs Improvement</p>
                    <p className="text-sm text-red-700">
                      Your forecasts show significant variance ({avgVariancePct.toFixed(1)}% on average). Consider reviewing
                      your assumptions and incorporating historical transaction data for better accuracy.
                    </p>
                  </div>
                )}

                {comparisonData.filter(d => Math.abs(d.variancePct) > 20).length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm font-semibold text-orange-900">High Variance Weeks Detected</p>
                    <p className="text-sm text-orange-700">
                      {comparisonData.filter(d => Math.abs(d.variancePct) > 20).length} weeks show variance greater than 20%.
                      Investigate these periods to understand unexpected cash flows.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
