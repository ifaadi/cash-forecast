'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
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

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [forecastData, setForecastData] = useState<any[]>([])
  const [kpis, setKPIs] = useState<any>({})
  const [revenueConfidence, setRevenueConfidence] = useState(100)
  const [expenseBuffer, setExpenseBuffer] = useState(100)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadForecast()
    }
  }, [user, revenueConfidence, expenseBuffer])

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
    const mockData = generateMockForecast(revenueConfidence, expenseBuffer)
    setForecastData(mockData.forecast)
    setKPIs(mockData.kpis)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💰 CFO Cash Command</h1>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scenario Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scenario Planning</CardTitle>
            <CardDescription>Adjust sliders to model different scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <CardTitle>13-Week Cash Balance Forecast</CardTitle>
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

        {/* AI Insights Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>AI CFO Insights</CardTitle>
            <CardDescription>Automated executive summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Liquidity Status:</p>
                <p className="text-sm text-gray-700">
                  Cash forecast shows {kpis.runway >= 10 ? 'healthy' : 'moderate'} runway for the next 13 weeks.
                  Lowest point occurs at Week {kpis.lowestWeek || 7} with {formatCurrency(kpis.lowestCash || 0)}.
                  {kpis.belowThreshold > 0 && ` Warning: ${kpis.belowThreshold} weeks fall below safety threshold.`}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Key Risks:</p>
                <p className="text-sm text-gray-700">
                  Monitor weeks {kpis.lowestWeek || 7}-{(kpis.lowestWeek || 7) + 2} for potential cash constraints.
                  {kpis.payrollRisk > 0 && ` ${kpis.payrollRisk} payroll periods may be at risk.`}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Recommendation:</p>
                <p className="text-sm text-gray-700">
                  {revenueConfidence < 90
                    ? 'Consider accelerating AR collections or securing short-term credit line.'
                    : 'Maintain current cash management practices. Consider growth investments if runway exceeds 12 weeks.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Mock data generator
function generateMockForecast(revConf: number, expBuf: number) {
  const forecast = []
  let balance = 250000
  const safetyThreshold = 50000

  for (let week = 1; week <= 13; week++) {
    const baseInflow = 45000 + (Math.random() * 5000 - 2500)
    const baseOutflow = week % 2 === 0 ? 50000 : 20000
    const additionalExpense = week % 4 === 0 ? 15000 : 0 // Rent every 4 weeks

    const inflow = baseInflow * (revConf / 100)
    const outflow = (baseOutflow + additionalExpense) * (expBuf / 100)
    const net = inflow - outflow
    balance += net

    forecast.push({
      week,
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      net: Math.round(net),
      balance: Math.round(balance),
    })
  }

  const balances = forecast.map(f => f.balance)
  const lowestCash = Math.min(...balances)
  const lowestWeek = forecast.find(f => f.balance === lowestCash)?.week || 0
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
