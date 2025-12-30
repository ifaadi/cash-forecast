'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { generateCFOInsights, type ForecastContext } from '@/lib/ai'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Sparkles, Loader2 } from 'lucide-react'

// Force dynamic rendering (disable static generation)
export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [forecastData, setForecastData] = useState<any[]>([])
  const [kpis, setKPIs] = useState<any>({})
  const [revenueConfidence, setRevenueConfidence] = useState(100)
  const [expenseBuffer, setExpenseBuffer] = useState(100)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [forecastWeeks, setForecastWeeks] = useState(13)
  const [aiInsights, setAIInsights] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadForecast()
    }
  }, [user, revenueConfidence, expenseBuffer, startDate, forecastWeeks])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)
    setLoading(false)
  }

  const loadForecast = async () => {
    // For MVP, use mock data
    const mockData = generateMockForecast(revenueConfidence, expenseBuffer, forecastWeeks, startDate)
    setForecastData(mockData.forecast)
    setKPIs(mockData.kpis)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
          {/* Navigation */}
          <nav className="flex gap-4 border-t pt-4">
            <Button onClick={() => router.push('/dashboard')} variant="default" size="sm">
              Dashboard
            </Button>
            <Button onClick={() => router.push('/transactions')} variant="outline" size="sm">
              Transactions
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Lowest Cash Point</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.lowestCash || 0)}</div>
              <p className="text-xs text-muted-foreground">Week {kpis.lowestWeek || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Weeks of Runway</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.runway || 0} weeks</div>
              <p className="text-xs text-muted-foreground">Burn: {formatCurrency(kpis.burnRate || 0)}/wk</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Weeks Below Threshold</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{kpis.belowThreshold || 0}</div>
              <p className="text-xs text-muted-foreground">weeks at risk</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Payroll Risk</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{kpis.payrollRisk || 0}</div>
              <p className="text-xs text-muted-foreground">high-risk periods</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Volatility</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.volatility || 'Low'}</div>
              <p className="text-xs text-muted-foreground">σ={formatCurrency(kpis.volatilityScore || 0)}</p>
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
                  <ReferenceLine y={50000} stroke="red" strokeDasharray="3 3" label="Safety" />
                  <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} name="Cash Balance" />
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

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>AI CFO Insights</CardTitle>
                <CardDescription>Powered by Google Gemini AI</CardDescription>
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
    </div>
  )
}

// Mock data generator
function generateMockForecast(revConf: number, expBuf: number, weeks: number, startDateStr: string) {
  const forecast = []
  let balance = 250000
  const safetyThreshold = 50000
  const startDate = new Date(startDateStr)

  for (let week = 1; week <= weeks; week++) {
    const baseInflow = 45000 + (Math.random() * 5000 - 2500)
    const baseOutflow = week % 2 === 0 ? 50000 : 20000
    const additionalExpense = week % 4 === 0 ? 15000 : 0 // Rent every 4 weeks

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
      payrollRisk: forecast.filter((f, i) => i % 2 === 0 && f.balance < 100000).length,
      volatility: avgBurnRate > 30000 ? 'High' : avgBurnRate > 15000 ? 'Medium' : 'Low',
      volatilityScore: Math.round(avgBurnRate),
    },
  }
}
