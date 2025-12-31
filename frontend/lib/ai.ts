// AI Service using Groq (Free & Fast Alternative)
// Calls Next.js API route to avoid CORS issues

export interface ForecastContext {
  forecast: Array<{
    week: number
    balance: number
    inflow: number
    outflow: number
    net: number
  }>
  kpis: {
    lowestCash: number
    lowestWeek: number
    runway: number
    burnRate: number
    belowThreshold: number
    payrollRisk: number
    volatility: string
    volatilityScore: number
  }
  safetyThreshold?: number
  transactions?: Array<{
    date: string
    type: string
    amount: number
    category?: string
    description?: string
  }>
  scenarios?: Array<{
    name: string
    revenue_adjustment: number
    expense_adjustment: number
  }>
  comparison?: {
    accuracyScore: number
    avgVariance: number
    weeksAnalyzed: number
  }
  anomalies?: Array<{
    category: string
    amount: number
    deviation: number
  }>
}

async function callGroq(prompt: string): Promise<string> {
  try {
    // Call our Next.js API route instead of Groq directly (avoids CORS)
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `API error: ${response.status}`)
    }

    const data = await response.json()
    return data.response || 'No response generated'
  } catch (error: any) {
    console.error('Groq API Error:', error)
    throw error
  }
}

export async function generateCFOInsights(context: ForecastContext): Promise<string> {
  try {
    const contextText = buildFinancialContext(context)

    const prompt = `You are a CFO providing actionable cash flow analysis. Be direct and specific.

FINANCIAL DATA:
${contextText}

Provide a brief executive summary answering these 5 questions:

1. **IMMEDIATE RISKS (next 2 weeks)**: What specific cash flow risks exist? Include dollar amounts and timing.

2. **TOP 3 PRIORITY ACTIONS**: Give 3 concrete actions with deadlines (e.g., "Accelerate AR collection by $X by [date]")

3. **What expenses to cut first**: Suggest specific categories and estimated savings based on the outflow patterns.

4. **Revenue acceleration opportunities**: Provide tangible ideas based on the cash flow patterns shown.

5. **Should I raise capital? If yes, how much and by when?**: Give a clear yes/no with specific reasoning based on runway and burn rate.

Be specific with numbers, dates, and actions. Don't say "need more data" - provide your best CFO judgment based on what's available.`

    return await callGroq(prompt)
  } catch (error: any) {
    console.error('AI Error:', error)
    const errorMsg = error?.message || error?.toString() || 'Unknown error'
    return `Unable to generate AI insights. Error: ${errorMsg}\n\nPlease ensure your Groq API key is set in Vercel environment variables as NEXT_PUBLIC_GROQ_API_KEY.\nGet a free key at: https://console.groq.com`
  }
}

export async function askCFO(question: string, context: ForecastContext): Promise<string> {
  try {
    const contextText = buildFinancialContext(context)

    const prompt = `You are an expert CFO with deep financial analysis skills. Answer the question briefly but intelligently.

FINANCIAL DATA:
${contextText}

USER QUESTION: ${question}

RESPONSE FORMAT:
- Use traffic light indicators: 🟢 (good/safe), 🟡 (caution/monitor), 🔴 (critical/urgent)
- Keep response to 1-2 lines maximum
- Be specific with numbers and dates
- Give actionable insight, not just facts

Examples of good responses:
"🟢 Your runway is solid at ${context.kpis.runway} weeks. Focus on Week ${context.kpis.lowestWeek} where cash dips to $${(context.kpis.lowestCash / 1000000).toFixed(1)}M"
"🔴 URGENT: ${context.kpis.belowThreshold} weeks below threshold. Cut expenses by $${(context.kpis.burnRate * 0.3 / 1000).toFixed(0)}K/week immediately"
"🟡 Revenue trending down. Accelerate collections by $${(context.kpis.burnRate * 2 / 1000).toFixed(0)}K before Week ${context.kpis.lowestWeek}"

Now answer the question using the same style - short, smart, with traffic lights.`

    return await callGroq(prompt)
  } catch (error: any) {
    console.error('AI Error:', error)
    const errorMsg = error?.message || error?.toString() || 'Unknown error'
    return `Sorry, I encountered an error: ${errorMsg}\n\nPlease ensure your Groq API key is set in Vercel environment variables as NEXT_PUBLIC_GROQ_API_KEY.`
  }
}

function buildFinancialContext(context: ForecastContext): string {
  const { forecast, kpis, anomalies, safetyThreshold = 1000000, transactions, scenarios, comparison } = context

  let text = `=== CASH FORECAST (${forecast.length} WEEKS) ===\n\n`

  // Show only critical weeks to keep context short
  text += `CRITICAL WEEKS:\n`
  forecast.forEach((week) => {
    const flags = []
    if (week.week === kpis.lowestWeek) flags.push('⚠️ LOWEST')
    if (week.balance < safetyThreshold) flags.push('🔴 DANGER')
    if (week.net < -500000) flags.push('📉 BIG BURN')

    if (flags.length > 0) {
      text += `Week ${week.week}: Net $${(week.net / 1000).toFixed(0)}K | Balance $${(week.balance / 1000000).toFixed(1)}M ${flags.join(' ')}\n`
    }
  })

  text += `\n=== KEY METRICS ===\n`
  text += `• Safety Threshold: $${(safetyThreshold / 1000000).toFixed(1)}M\n`
  text += `• Lowest Cash: Week ${kpis.lowestWeek} at $${(kpis.lowestCash / 1000000).toFixed(2)}M\n`
  text += `• Runway: ${kpis.runway} weeks\n`
  text += `• Avg Burn: $${(kpis.burnRate / 1000).toFixed(0)}K/week\n`
  text += `• Weeks Below Threshold: ${kpis.belowThreshold}\n`
  text += `• Volatility: ${kpis.volatility}\n`

  // Add transaction insights if available
  if (transactions && transactions.length > 0) {
    const recentInflows = transactions.filter(t => t.type === 'Inflow').slice(0, 5)
    const recentOutflows = transactions.filter(t => t.type === 'Outflow').slice(0, 5)
    const totalInflow = recentInflows.reduce((sum, t) => sum + t.amount, 0)
    const totalOutflow = recentOutflows.reduce((sum, t) => sum + t.amount, 0)

    text += `\n=== RECENT ACTIVITY ===\n`
    text += `• Recent Inflows: $${(totalInflow / 1000).toFixed(0)}K across ${recentInflows.length} transactions\n`
    text += `• Recent Outflows: $${(totalOutflow / 1000).toFixed(0)}K across ${recentOutflows.length} transactions\n`
  }

  // Add forecast accuracy if available
  if (comparison) {
    text += `\n=== FORECAST ACCURACY ===\n`
    text += `• Accuracy Score: ${comparison.accuracyScore.toFixed(0)}%\n`
    text += `• Avg Variance: ${comparison.avgVariance.toFixed(1)}%\n`
  }

  // Add scenarios if available
  if (scenarios && scenarios.length > 0) {
    text += `\n=== SCENARIOS ===\n`
    scenarios.forEach(s => {
      text += `• ${s.name}: Rev ${s.revenue_adjustment}%, Exp ${s.expense_adjustment}%\n`
    })
  }

  if (anomalies && anomalies.length > 0) {
    text += `\n=== ANOMALIES ===\n`
    anomalies.forEach((anom) => {
      text += `• ${anom.category}: $${(anom.amount / 1000).toFixed(0)}K (${anom.deviation > 0 ? '+' : ''}${anom.deviation.toFixed(0)}%)\n`
    })
  }

  return text
}

