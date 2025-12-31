'use client'

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface WaterfallData {
  name: string
  value: number
  total: number
  isTotal?: boolean
}

interface WaterfallChartProps {
  data: WaterfallData[]
  height?: number
}

export function WaterfallChart({ data, height = 400 }: WaterfallChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Calculate positions for waterfall effect
  const waterfallData = data.map((item, index) => {
    if (index === 0 || item.isTotal) {
      return {
        ...item,
        start: 0,
        end: item.total,
        change: item.value,
      }
    }

    const prevTotal = data[index - 1].total
    const isPositive = item.value >= 0

    return {
      ...item,
      start: isPositive ? prevTotal : prevTotal + item.value,
      end: isPositive ? prevTotal + item.value : prevTotal,
      change: item.value,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis
          tickFormatter={(value) => formatCurrency(value)}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value: any) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
          }}
        />
        <Legend />

        {/* Invisible bar to create starting point */}
        <Bar dataKey="start" stackId="stack" fill="transparent" />

        {/* Actual change bar */}
        <Bar dataKey="change" stackId="stack" name="Cash Flow">
          {waterfallData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.isTotal
                  ? '#6366f1' // Indigo for totals
                  : entry.change >= 0
                  ? '#10b981' // Green for positive
                  : '#ef4444' // Red for negative
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
