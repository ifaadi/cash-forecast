'use client'

import { useEffect, useState, useRef } from 'react'
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
import { TrendingUp, TrendingDown, AlertTriangle, Upload, Save, RefreshCw } from 'lucide-react'

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
  const [manualForecastData, setManualForecastData] = useState<Array<{ weekNumber: number, weekDate: string, forecastedNet: number }>>([])
  const [editingWeek, setEditingWeek] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [forecastId, setForecastId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    // Get forecast data from database
    const { data: forecasts } = await supabase
      .from('forecasts')
      .select(`
        id,
        start_date,
        forecast_weeks (
          week_number,
          week_date,
          net
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (forecasts?.id) {
      setForecastId(forecasts.id)
    }

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

    // Initialize manual forecast data structure based on date range
    initializeManualForecastData(forecasts?.forecast_weeks || [])

    // Generate comparison data (forecast vs actuals)
    const comparison = generateComparison(transactions || [], forecasts?.forecast_weeks || [], startDate, endDate)
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

  const initializeManualForecastData = (forecastWeeks: any[]) => {
    const startD = new Date(startDate)
    const endD = new Date(endDate)
    const weeks: Array<{ weekNumber: number, weekDate: string, forecastedNet: number }> = []

    let weekNum = 1
    let currentWeekStart = new Date(startD)

    while (currentWeekStart <= endD) {
      // Get existing forecast value if available
      const existingForecast = forecastWeeks.find((fw: any) => {
        const fwDate = new Date(fw.week_date)
        const currentWeekEnd = new Date(currentWeekStart)
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
        return fwDate >= currentWeekStart && fwDate <= currentWeekEnd
      })

      weeks.push({
        weekNumber: weekNum,
        weekDate: currentWeekStart.toISOString().split('T')[0],
        forecastedNet: existingForecast?.net || 0,
      })

      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
      weekNum++

      if (weekNum > 52) break
    }

    setManualForecastData(weeks)
  }

  const saveManualForecast = async () => {
    if (!forecastId) {
      alert('No active forecast found. Please create a forecast from the Dashboard first.')
      return
    }

    setSaving(true)
    try {
      // Update forecast_weeks with manual values
      for (const week of manualForecastData) {
        const { error } = await supabase
          .from('forecast_weeks')
          .upsert({
            forecast_id: forecastId,
            week_number: week.weekNumber,
            week_date: week.weekDate,
            net: week.forecastedNet,
            inflow: week.forecastedNet > 0 ? week.forecastedNet : 0,
            outflow: week.forecastedNet < 0 ? Math.abs(week.forecastedNet) : 0,
            balance: 0, // Will be recalculated
            is_manual: true, // Mark as manually entered
          }, {
            onConflict: 'forecast_id,week_number'
          })

        if (error) {
          console.error('Error saving week:', error)
        }
      }

      alert('Manual forecast saved successfully!')
      loadComparison() // Reload to show updated comparison
    } catch (error) {
      console.error('Error saving manual forecast:', error)
      alert('Failed to save manual forecast')
    } finally {
      setSaving(false)
    }
  }

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n')

      // Skip header row
      const dataLines = lines.slice(1).filter(line => line.trim())

      const uploadedData: Array<{ weekNumber: number, weekDate: string, forecastedNet: number }> = []

      dataLines.forEach((line, index) => {
        const [weekDate, forecastedNet] = line.split(',')
        if (weekDate && forecastedNet) {
          uploadedData.push({
            weekNumber: index + 1,
            weekDate: weekDate.trim(),
            forecastedNet: parseFloat(forecastedNet.trim()),
          })
        }
      })

      if (uploadedData.length > 0) {
        setManualForecastData(uploadedData)
        alert(`Loaded ${uploadedData.length} weeks from CSV`)
      }
    }

    reader.readAsText(file)
  }

  const updateWeekForecast = (weekNumber: number, value: string) => {
    const numValue = parseFloat(value) || 0
    setManualForecastData(prev =>
      prev.map(week =>
        week.weekNumber === weekNumber
          ? { ...week, forecastedNet: numValue }
          : week
      )
    )
    setEditingWeek(null)
    setEditValue('')
  }

  const generateComparison = (transactions: any[], forecastWeeks: any[], start: string, end: string): ComparisonData[] => {
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
        .reduce((sum, t) => sum + Number(t.amount), 0)
      const actualOutflow = weekTransactions
        .filter(t => t.type === 'Outflow')
        .reduce((sum, t) => sum + Number(t.amount), 0)
      const actualNet = actualInflow - actualOutflow

      // Get forecasted value from database or use mock if no forecast
      const forecastWeek = forecastWeeks.find((fw: any) => {
        const fwDate = new Date(fw.week_date)
        return fwDate >= currentWeekStart && fwDate <= currentWeekEnd
      })
      const forecastedNet = forecastWeek?.net || generateMockForecast(weekNum)

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

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    } else if (value <= -1000000) {
      return `-$${(Math.abs(value) / 1000000).toFixed(1)}M`
    } else if (value <= -1000) {
      return `-$${(Math.abs(value) / 1000).toFixed(0)}K`
    }
    return `$${value}`
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

        {/* Manual Forecast Entry */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>📝 Manual Weekly Forecast Entry</CardTitle>
                <CardDescription>
                  Enter or upload your weekly cash flow forecast for comparison with actual transactions
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveManualForecast}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Forecast'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>How to use:</strong>
              </p>
              <ul className="text-sm text-blue-800 mt-1 list-disc list-inside">
                <li>Click on any "Forecasted Net" cell to edit the value</li>
                <li>Enter positive numbers for expected net inflow, negative for outflow</li>
                <li>Upload a CSV file with columns: Week Date, Forecasted Net Cash Flow</li>
                <li>Click "Save Forecast" to persist your manual forecast to the database</li>
                <li>These values will be used for "Forecast vs Actual" comparison below</li>
              </ul>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 border-b">Week #</th>
                    <th className="text-left py-3 px-4 border-b">Week Date</th>
                    <th className="text-right py-3 px-4 border-b">Forecasted Net Cash Flow</th>
                    <th className="text-center py-3 px-4 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manualForecastData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-500">
                        Set a date range above to start entering forecast data
                      </td>
                    </tr>
                  ) : (
                    manualForecastData.map((week) => (
                      <tr key={week.weekNumber} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">W{week.weekNumber}</td>
                        <td className="py-3 px-4">
                          {new Date(week.weekDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {editingWeek === week.weekNumber ? (
                            <div className="flex justify-end gap-2">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateWeekForecast(week.weekNumber, editValue)
                                  } else if (e.key === 'Escape') {
                                    setEditingWeek(null)
                                    setEditValue('')
                                  }
                                }}
                                className="w-40 text-right"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => updateWeekForecast(week.weekNumber, editValue)}
                              >
                                ✓
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingWeek(null)
                                  setEditValue('')
                                }}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <span
                              className={`font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded ${
                                week.forecastedNet >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                              onClick={() => {
                                setEditingWeek(week.weekNumber)
                                setEditValue(week.forecastedNet.toString())
                              }}
                            >
                              {formatCurrency(week.forecastedNet)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingWeek(week.weekNumber)
                              setEditValue(week.forecastedNet.toString())
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {manualForecastData.length} weeks loaded | Total Forecasted:{' '}
                <span className={manualForecastData.reduce((sum, w) => sum + w.forecastedNet, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(manualForecastData.reduce((sum, w) => sum + w.forecastedNet, 0))}
                </span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadComparison()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Forecast vs Actual Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Forecast vs Actual Net Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={comparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="forecasted"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    name="Forecasted"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    name="Actual"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
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
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={comparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar
                    dataKey="variance"
                    fill="#f59e0b"
                    name="Variance ($)"
                    radius={[4, 4, 0, 0]}
                  />
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

        {/* Insights - Traffic Light Format */}
        {comparisonData.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
              <CardDescription>Auto-generated analysis based on forecast vs actual performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Forecast Source Info */}
                <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm font-semibold text-blue-900 mb-2">📊 Understanding Your Forecast Data</p>
                  <p className="text-sm text-blue-800">
                    <strong>Forecast:</strong> Generated from Dashboard sliders (Revenue Confidence & Expense Buffer). These create weekly projections saved to the database.
                    <br />
                    <strong>Actual:</strong> Real transactions from the Transactions page, summed by week. Add transactions to see accurate comparisons.
                  </p>
                </div>

                {/* Green Light - Good Performance */}
                {accuracyScore >= 80 && (
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      <p className="text-sm font-semibold text-green-900">Strong Forecast Accuracy</p>
                    </div>
                    <p className="text-sm text-green-800">
                      Accuracy: {accuracyScore.toFixed(0)}% | Avg Variance: {avgVariancePct.toFixed(1)}%
                      <br />
                      Your forecasting methodology is working well. Continue using current Revenue Confidence and Expense Buffer settings.
                    </p>
                  </div>
                )}

                {/* Yellow Light - Warning */}
                {accuracyScore >= 50 && accuracyScore < 80 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                      <p className="text-sm font-semibold text-yellow-900">Moderate Forecast Accuracy</p>
                    </div>
                    <p className="text-sm text-yellow-800">
                      Accuracy: {accuracyScore.toFixed(0)}% | Avg Variance: {avgVariancePct.toFixed(1)}%
                      <br />
                      <strong>Action Required:</strong> Review largest variance weeks below and adjust Dashboard sliders. Consider historical patterns from past 3-6 months.
                    </p>
                  </div>
                )}

                {/* Red Light - Critical */}
                {accuracyScore < 50 && (
                  <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full bg-red-500"></div>
                      <p className="text-sm font-semibold text-red-900">Forecast Needs Immediate Attention</p>
                    </div>
                    <p className="text-sm text-red-800">
                      Accuracy: {accuracyScore.toFixed(0)}% | Avg Variance: {avgVariancePct.toFixed(1)}%
                      <br />
                      <strong>Critical Actions:</strong>
                      1) Add more transactions for accurate actuals
                      2) Adjust Revenue Confidence & Expense Buffer sliders on Dashboard
                      3) Review cash flow timing assumptions
                    </p>
                  </div>
                )}

                {/* High Variance Detection - Red Light */}
                {comparisonData.filter(d => Math.abs(d.variancePct) > 50).length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full bg-red-500"></div>
                      <p className="text-sm font-semibold text-red-900">Extreme Variance Detected</p>
                    </div>
                    <p className="text-sm text-red-800">
                      {comparisonData.filter(d => Math.abs(d.variancePct) > 50).length} weeks exceed 50% variance.
                      These weeks indicate unexpected cash events or incorrect forecast assumptions. Review weekly breakdown below.
                    </p>
                  </div>
                )}

                {/* Missing Actuals Warning - Yellow Light */}
                {comparisonData.filter(d => d.actual === 0).length > comparisonData.length * 0.5 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                      <p className="text-sm font-semibold text-yellow-900">Limited Transaction Data</p>
                    </div>
                    <p className="text-sm text-yellow-800">
                      {comparisonData.filter(d => d.actual === 0).length} of {comparisonData.length} weeks have $0 in actuals.
                      <br />
                      <strong>Action:</strong> Go to Transactions page and add real inflows/outflows to improve forecast accuracy.
                    </p>
                  </div>
                )}

                {/* Good Weeks - Green Light */}
                {comparisonData.filter(d => Math.abs(d.variancePct) <= 20 && d.actual !== 0).length > 3 && (
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      <p className="text-sm font-semibold text-green-900">High-Accuracy Weeks Identified</p>
                    </div>
                    <p className="text-sm text-green-800">
                      {comparisonData.filter(d => Math.abs(d.variancePct) <= 20 && d.actual !== 0).length} weeks achieved ±20% variance accuracy.
                      Study these periods to understand what forecasting assumptions worked best.
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
