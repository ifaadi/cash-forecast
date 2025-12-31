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

    const prompt = `You are a CFO assistant answering questions about cash flow.

CRITICAL: Answer ONLY using the financial data below. If the answer isn't in the data, say so.

FINANCIAL DATA:
${contextText}

USER QUESTION:
${question}

Provide a clear, concise answer based ONLY on the data above. If you cannot answer from the data provided, explain what information is missing.`

    return await callGroq(prompt)
  } catch (error: any) {
    console.error('AI Error:', error)
    const errorMsg = error?.message || error?.toString() || 'Unknown error'
    return `Sorry, I encountered an error: ${errorMsg}\n\nPlease ensure your Groq API key is set in Vercel environment variables as NEXT_PUBLIC_GROQ_API_KEY.`
  }
}

function buildFinancialContext(context: ForecastContext): string {
  const { forecast, kpis, anomalies, safetyThreshold = 1000000 } = context

  let text = `=== CASH FORECAST (${forecast.length} WEEKS) ===\n\n`

  text += `WEEKLY CASH FLOW:\n`
  forecast.forEach((week) => {
    const flags = []
    if (week.week === kpis.lowestWeek) flags.push('⚠️ CRITICAL')
    if (week.balance < safetyThreshold) flags.push('🔴 BELOW THRESHOLD')
    if (week.net < 0) flags.push('📉 BURN')

    const flagStr = flags.length > 0 ? ` ${flags.join(' ')}` : ''
    text += `Week ${week.week}: Inflow $${(week.inflow / 1000).toFixed(0)}K | Outflow $${(week.outflow / 1000).toFixed(0)}K | Net $${(week.net / 1000).toFixed(0)}K | Balance $${(week.balance / 1000000).toFixed(1)}M${flagStr}\n`
  })

  text += `\n=== KEY METRICS ===\n`
  text += `• Safety Threshold: $${(safetyThreshold / 1000000).toFixed(1)}M\n`
  text += `• Lowest Cash: Week ${kpis.lowestWeek} at $${(kpis.lowestCash / 1000000).toFixed(2)}M\n`
  text += `• Runway: ${kpis.runway} weeks at current burn\n`
  text += `• Avg Burn: $${(kpis.burnRate / 1000).toFixed(0)}K/week\n`
  text += `• Weeks Below Threshold: ${kpis.belowThreshold}\n`
  text += `• Payroll Risk Weeks: ${kpis.payrollRisk}\n`
  text += `• Volatility: ${kpis.volatility}\n`

  if (anomalies && anomalies.length > 0) {
    text += `\n=== ANOMALIES ===\n`
    anomalies.forEach((anom) => {
      text += `• ${anom.category}: $${(anom.amount / 1000).toFixed(0)}K (${anom.deviation > 0 ? '+' : ''}${anom.deviation.toFixed(0)}% vs avg)\n`
    })
  }

  return text
}

