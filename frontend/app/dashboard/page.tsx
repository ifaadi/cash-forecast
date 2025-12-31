'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { generateCFOInsights, askCFO, type ForecastContext } from '@/lib/ai'
import { getOrCreateActiveForecast, updateForecast } from '@/lib/forecast-service'
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
  ReferenceLine,
} from 'recharts'
import { Sparkles, Loader2, AlertTriangle, Phone, DollarSign, TrendingDown, Zap } from 'lucide-react'
import { WaterfallChart } from '@/components/waterfall-chart'

// Force dynamic rendering (disable static generation)
export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [forecastId, setForecastId] = useState<string | null>(null)
  const [forecastData, setForecastData] = useState<any[]>([])
  const [kpis, setKPIs] = useState<any>({})
  const [revenueConfidence, setRevenueConfidence] = useState(100)
  const [expenseBuffer, setExpenseBuffer] = useState(100)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [forecastWeeks, setForecastWeeks] = useState(13)
  const [aiInsights, setAIInsights] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)
  const [showPanicMode, setShowPanicMode] = useState(false)
  const [panicAnalysis, setPanicAnalysis] = useState('')
  const [loadingPanic, setLoadingPanic] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  // Load initial forecast
  useEffect(() => {
    if (user) {
      loadInitialForecast()
    }
  }, [user])

  // Update forecast when parameters change (debounced)
  useEffect(() => {
    if (user && forecastId && !updating) {
      const timeoutId = setTimeout(() => {
        updateForecastData()
      }, 500) // Debounce for better performance
      return () => clearTimeout(timeoutId)
    }
  }, [revenueConfidence, expenseBuffer, startDate, forecastWeeks, forecastId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)
    setLoading(false)
  }

  const loadInitialForecast = useCallback(async () => {
    try {
      setLoading(true)
      const forecast = await getOrCreateActiveForecast(user.id)

      if (forecast) {
        setForecastId(forecast.id)
        setStartDate(forecast.start_date)
        setForecastWeeks(forecast.weeks)
        setRevenueConfidence(forecast.revenue_confidence)
        setExpenseBuffer(forecast.expense_buffer)

        // Transform data for display
        const displayData = forecast.forecast_weeks
          .sort((a, b) => a.week_number - b.week_number)
          .map(week => ({
            week: `W${week.week_number} (${new Date(week.week_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
            weekNumber: week.week_number,
            inflow: week.inflow,
            outflow: week.outflow,
            net: week.net,
            balance: week.balance,
          }))

        setForecastData(displayData)
        calculateKPIs(displayData)
      }
    } catch (error) {
      console.error('Error loading forecast:', error)
      // Fallback to mock data if Supabase fails
      const mockData = generateMockForecast(100, 100, 13, new Date().toISOString().split('T')[0])
      setForecastData(mockData.forecast)
      setKPIs(mockData.kpis)
    } finally {
      setLoading(false)
    }
  }, [user])

  const updateForecastData = useCallback(async () => {
    if (!forecastId) return

    try {
      setUpdating(true)
      const updatedForecast = await updateForecast(forecastId, {
        revenue_confidence: revenueConfidence,
        expense_buffer: expenseBuffer,
        weeks: forecastWeeks,
        start_date: startDate,
      })

      if (updatedForecast) {
        const displayData = updatedForecast.forecast_weeks
          .sort((a, b) => a.week_number - b.week_number)
          .map(week => ({
            week: `W${week.week_number} (${new Date(week.week_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
            weekNumber: week.week_number,
            inflow: week.inflow,
            outflow: week.outflow,
            net: week.net,
            balance: week.balance,
          }))

        setForecastData(displayData)
        calculateKPIs(displayData)
      }
    } catch (error) {
      console.error('Error updating forecast:', error)
    } finally {
      setUpdating(false)
    }
  }, [forecastId, revenueConfidence, expenseBuffer, forecastWeeks, startDate])

  const calculateKPIs = useCallback((data: any[]) => {
    const balances = data.map(f => f.balance)
    const lowestCash = Math.min(...balances)
    const lowestWeek = data.find(f => f.balance === lowestCash)?.weekNumber || 0
    const negativeFlows = data.filter(f => f.net < 0)
    const avgBurnRate = negativeFlows.length > 0
      ? Math.abs(negativeFlows.reduce((sum, f) => sum + f.net, 0) / negativeFlows.length)
      : 0

    const finalBalance = data[data.length - 1]?.balance || 0

    setKPIs({
      lowestCash,
      lowestWeek,
      runway: avgBurnRate > 0 ? Math.floor(finalBalance / avgBurnRate) : 99,
      burnRate: Math.round(avgBurnRate),
      belowThreshold: data.filter(f => f.balance < 1000000).length,
      payrollRisk: data.filter((f, i) => i % 2 === 0 && f.balance < 2000000).length,
      volatility: avgBurnRate > 600000 ? 'High' : avgBurnRate > 300000 ? 'Medium' : 'Low',
      volatilityScore: Math.round(avgBurnRate),
    })
  }, [])

  // Memoize waterfall data calculation for performance
  const waterfallData = useMemo(() => {
    if (!forecastData.length) return []

    const totalInflows = forecastData.reduce((sum, f) => sum + f.inflow, 0)
    const totalOutflows = forecastData.reduce((sum, f) => sum + f.outflow, 0)
    const startingBalance = 5000000
    const endingBalance = forecastData[forecastData.length - 1]?.balance || 0

    return [
      {
        name: 'Starting Cash',
        value: startingBalance,
        total: startingBalance,
        isTotal: true,
      },
      {
        name: 'Total Inflows',
        value: totalInflows,
        total: startingBalance + totalInflows,
      },
      {
        name: 'Total Outflows',
        value: -totalOutflows,
        total: startingBalance + totalInflows - totalOutflows,
      },
      {
        name: 'Ending Cash',
        value: endingBalance,
        total: endingBalance,
        isTotal: true,
      },
    ]
  }, [forecastData])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [])

  const generateInsights = async () => {
    setLoadingAI(true)
    try {
      const context: ForecastContext = {
        forecast: forecastData,
        kpis: kpis,
      }
      const insights = await generateCFOInsights(context)
      setAIInsights(insights)
    } catch (error) {
      console.error('Error generating insights:', error)
      setAIInsights('Unable to generate insights at this time. Please try again.')
    } finally {
      setLoadingAI(false)
    }
  }

  const handlePanicMode = async () => {
    setShowPanicMode(true)
    setLoadingPanic(true)
    try {
      const context: ForecastContext = {
        forecast: forecastData,
        kpis: kpis,
      }
      const analysis = await askCFO(
        `EMERGENCY ANALYSIS NEEDED: I need immediate help understanding my cash position. Current situation:
        - Cash runway: ${kpis.runway} weeks
        - Lowest cash point: ${formatCurrency(kpis.lowestCash)} at week ${kpis.lowestWeek}
        - Weeks below threshold: ${kpis.belowThreshold}
        - Volatility: ${kpis.volatility}

        Please provide:
        1. IMMEDIATE RISKS (next 2 weeks)
        2. TOP 3 PRIORITY ACTIONS I must take today
        3. What expenses to cut first
        4. Revenue acceleration opportunities
        5. Should I raise capital? If yes, how much and by when?

        Be direct and actionable. I need clarity, not theory.`,
        context
      )
      setPanicAnalysis(analysis)
    } catch (error) {
      console.error('Error generating panic analysis:', error)
      setPanicAnalysis('Unable to generate emergency analysis. Please try again or contact support immediately.')
    } finally {
      setLoadingPanic(false)
    }
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
              <h1 className="text-2xl font-bold text-gray-900">💰 CFO Cash Command</h1>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handlePanicMode}
                className="bg-red-600 hover:bg-red-700 text-white font-bold animate-pulse"
              >
                <AlertTriangle className="h-5 w-5 mr-2" />
                🚨 PANIC MODE
              </Button>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
          {/* Navigation */}
          <nav className="flex gap-4 border-t pt-4">
            <Button onClick={() => router.push('/dashboard')} variant="default" size="sm">
              Dashboard
            </Button>
            <Button onClick={() => router.push('/transactions')} variant="outline" size="sm">
              Transactions
            </Button>
            <Button onClick={() => router.push('/actuals-vs-forecast')} variant="outline" size="sm">
              Actuals vs Forecast
            </Button>
            <Button onClick={() => router.push('/analytics')} variant="outline" size="sm">
              Analytics
            </Button>
            <Button onClick={() => router.push('/chat')} variant="outline" size="sm">
              Ask CFO
            </Button>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scenario Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Forecast Settings & Scenario Planning</CardTitle>
            <CardDescription>Configure forecast period and adjust scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
              <div>
                <label className="text-sm font-medium block mb-2">Forecast Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Forecast Period</label>
                <select
                  value={forecastWeeks}
                  onChange={(e) => setForecastWeeks(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="8">8 weeks (2 months)</option>
                  <option value="13">13 weeks (1 quarter)</option>
                  <option value="26">26 weeks (2 quarters)</option>
                  <option value="52">52 weeks (1 year)</option>
                </select>
              </div>
            </div>

            {/* Scenario Sliders */}
            <div>
              <label className="text-sm font-medium">Revenue Confidence: {revenueConfidence}%</label>
              <input
                type="range"
                min="70"
                max="110"
                value={revenueConfidence}
                onChange={(e) => setRevenueConfidence(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expense Buffer: {expenseBuffer}%</label>
              <input
                type="range"
                min="90"
                max="150"
                value={expenseBuffer}
                onChange={(e) => setExpenseBuffer(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards - Modern Design */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-blue-700 font-medium">Lowest Cash Point</CardDescription>
                <TrendingDown className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(kpis.lowestCash || 0)}</div>
              <p className="text-sm text-blue-600 mt-1">Week {kpis.lowestWeek || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-green-700 font-medium">Weeks of Runway</CardDescription>
                <Zap className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{kpis.runway || 0} weeks</div>
              <p className="text-sm text-green-600 mt-1">Burn: {formatCurrency(kpis.burnRate || 0)}/wk</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-orange-700 font-medium">Weeks Below Threshold</CardDescription>
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{kpis.belowThreshold || 0}</div>
              <p className="text-sm text-orange-600 mt-1">weeks at risk</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-red-700 font-medium">Payroll Risk</CardDescription>
                <Phone className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">{kpis.payrollRisk || 0}</div>
              <p className="text-sm text-red-600 mt-1">high-risk periods</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-purple-700 font-medium">Volatility</CardDescription>
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{kpis.volatility || 'Low'}</div>
              <p className="text-sm text-purple-600 mt-1">σ={formatCurrency(kpis.volatilityScore || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cash Balance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{forecastWeeks}-Week Cash Balance Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Cash Balance ($)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <ReferenceLine y={1000000} stroke="#ef4444" strokeDasharray="3 3" label="Safety Threshold" />
                  <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} name="Cash Balance" dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Inflows vs Outflows */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Inflows vs Outflows</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="inflow" fill="#10b981" name="Inflows" />
                  <Bar dataKey="outflow" fill="#ef4444" name="Outflows" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Waterfall Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cash Flow Waterfall Analysis</CardTitle>
            <CardDescription>Visual breakdown of cash movements and final position</CardDescription>
          </CardHeader>
          <CardContent>
            <WaterfallChart
              data={[
                {
                  name: 'Starting Cash',
                  value: 5000000,
                  total: 5000000,
                  isTotal: true,
                },
                {
                  name: 'Total Inflows',
                  value: forecastData.reduce((sum, f) => sum + f.inflow, 0),
                  total: 5000000 + forecastData.reduce((sum, f) => sum + f.inflow, 0),
                },
                {
                  name: 'Total Outflows',
                  value: -forecastData.reduce((sum, f) => sum + f.outflow, 0),
                  total: 5000000 + forecastData.reduce((sum, f) => sum + f.inflow, 0) - forecastData.reduce((sum, f) => sum + f.outflow, 0),
                },
                {
                  name: 'Ending Cash',
                  value: forecastData[forecastData.length - 1]?.balance || 0,
                  total: forecastData[forecastData.length - 1]?.balance || 0,
                  isTotal: true,
                },
              ]}
              height={350}
            />
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>AI CFO Insights</CardTitle>
                <CardDescription>Powered by Groq AI (Llama 3.1 70B)</CardDescription>
              </div>
              <Button onClick={generateInsights} disabled={loadingAI} size="sm">
                {loadingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Insights
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiInsights ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{aiInsights}</pre>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-8 rounded-lg text-center border-2 border-dashed border-gray-300">
                <Sparkles className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-2">No AI insights generated yet</p>
                <p className="text-sm text-gray-500">Click "Generate Insights" to get AI-powered analysis of your cash forecast</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Panic Mode Modal */}
      {showPanicMode && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold mb-2 flex items-center">
                    <AlertTriangle className="h-8 w-8 mr-3 animate-pulse" />
                    🚨 EMERGENCY CASH ANALYSIS
                  </h2>
                  <p className="text-red-100">AI-Powered Crisis Management</p>
                </div>
                <button
                  onClick={() => setShowPanicMode(false)}
                  className="text-white hover:text-red-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingPanic ? (
                <div className="text-center py-12">
                  <Loader2 className="h-16 w-16 animate-spin mx-auto text-red-600 mb-4" />
                  <p className="text-xl font-semibold text-gray-900">Analyzing your situation...</p>
                  <p className="text-gray-600 mt-2">Generating emergency recommendations</p>
                </div>
              ) : panicAnalysis ? (
                <>
                  {/* AI Analysis */}
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center">
                      <Zap className="h-5 w-5 mr-2" />
                      Emergency Action Plan
                    </h3>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-white p-4 rounded border">
                        {panicAnalysis}
                      </pre>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center text-green-700">
                          <DollarSign className="h-5 w-5 mr-2" />
                          Revenue Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          onClick={() => router.push('/transactions')}
                          className="w-full justify-start bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          Review Receivables →
                        </Button>
                        <Button
                          onClick={() => router.push('/chat')}
                          className="w-full justify-start bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          Ask: "How to accelerate cash?" →
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center text-orange-700">
                          <TrendingDown className="h-5 w-5 mr-2" />
                          Cost Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          onClick={() => router.push('/analytics')}
                          className="w-full justify-start bg-orange-600 hover:bg-orange-700"
                          size="sm"
                        >
                          View Top Expenses →
                        </Button>
                        <Button
                          onClick={() => router.push('/transactions')}
                          className="w-full justify-start bg-orange-600 hover:bg-orange-700"
                          size="sm"
                        >
                          Cut Non-Essentials →
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center text-blue-700">
                          <Phone className="h-5 w-5 mr-2" />
                          Get Help
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          onClick={() => router.push('/chat')}
                          className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          Talk to AI CFO →
                        </Button>
                        <Button
                          onClick={() => window.open('mailto:support@yourcompany.com?subject=Emergency Cash Situation', '_blank')}
                          className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          Contact Financial Advisor →
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center text-purple-700">
                          <Sparkles className="h-5 w-5 mr-2" />
                          Forecast Tools
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          onClick={() => { setShowPanicMode(false); router.push('/dashboard'); }}
                          className="w-full justify-start bg-purple-600 hover:bg-purple-700"
                          size="sm"
                        >
                          Run Scenarios →
                        </Button>
                        <Button
                          onClick={() => router.push('/actuals-vs-forecast')}
                          className="w-full justify-start bg-purple-600 hover:bg-purple-700"
                          size="sm"
                        >
                          Check Forecast Accuracy →
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Current Snapshot */}
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <h4 className="font-semibold text-gray-900 mb-3">Current Cash Position Snapshot</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Runway</p>
                        <p className="text-xl font-bold text-gray-900">{kpis.runway} weeks</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Lowest Cash</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(kpis.lowestCash)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Burn Rate</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(kpis.burnRate)}/wk</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Risk Weeks</p>
                        <p className="text-xl font-bold text-red-600">{kpis.belowThreshold}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <AlertTriangle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Click the button above to generate emergency analysis</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
              <p className="text-sm text-gray-600">
                💡 Tip: This analysis is based on your current forecast data
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setShowPanicMode(false)} variant="outline">
                  Close
                </Button>
                {panicAnalysis && (
                  <Button onClick={handlePanicMode} variant="outline">
                    <Loader2 className="h-4 w-4 mr-2" />
                    Refresh Analysis
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mock data generator
function generateMockForecast(revConf: number, expBuf: number, weeks: number, startDateStr: string) {
  const forecast = []
  let balance = 5000000 // Starting balance: $5M
  const safetyThreshold = 1000000 // Safety threshold: $1M
  const startDate = new Date(startDateStr)

  for (let week = 1; week <= weeks; week++) {
    // Base inflow: ~$900K per week with variation
    const baseInflow = 900000 + (Math.random() * 100000 - 50000)
    // Base outflow: $1M (even weeks) or $400K (odd weeks)
    const baseOutflow = week % 2 === 0 ? 1000000 : 400000
    // Additional large expense every 4 weeks: $300K
    const additionalExpense = week % 4 === 0 ? 300000 : 0

    const inflow = baseInflow * (revConf / 100)
    const outflow = (baseOutflow + additionalExpense) * (expBuf / 100)
    const net = inflow - outflow
    balance += net

    // Calculate the date for this week
    const weekDate = new Date(startDate)
    weekDate.setDate(startDate.getDate() + (week - 1) * 7)
    const weekLabel = `W${week} (${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`

    forecast.push({
      week: weekLabel,
      weekNumber: week,
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      net: Math.round(net),
      balance: Math.round(balance),
    })
  }

  const balances = forecast.map(f => f.balance)
  const lowestCash = Math.min(...balances)
  const lowestWeek = forecast.find(f => f.balance === lowestCash)?.weekNumber || 0
  const negativeFlows = forecast.filter(f => f.net < 0)
  const avgBurnRate = negativeFlows.length > 0
    ? Math.abs(negativeFlows.reduce((sum, f) => sum + f.net, 0) / negativeFlows.length)
    : 0

  return {
    forecast,
    kpis: {
      lowestCash,
      lowestWeek,
      runway: avgBurnRate > 0 ? Math.floor(balance / avgBurnRate) : 99,
      burnRate: Math.round(avgBurnRate),
      belowThreshold: forecast.filter(f => f.balance < safetyThreshold).length,
      payrollRisk: forecast.filter((f, i) => i % 2 === 0 && f.balance < 2000000).length,
      volatility: avgBurnRate > 600000 ? 'High' : avgBurnRate > 300000 ? 'Medium' : 'Low',
      volatilityScore: Math.round(avgBurnRate),
    },
  }
}
