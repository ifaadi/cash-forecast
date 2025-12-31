// AI Service using Groq (Free & Fast Alternative)
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || 'gsk_qvP9xH7KcW9YFzJ3vN2FWGdyb3FYZ8mK5nL4pR6tS7uV8wX9yA0bC1dE2fG3h'

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
  anomalies?: Array<{
    category: string
    amount: number
    deviation: number
  }>
}

async function callGroq(prompt: string): Promise<string> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile', // Free, fast, and powerful
        messages: [
          {
            role: 'system',
            content: 'You are a seasoned CFO providing clear, actionable financial insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || 'No response generated'
  } catch (error: any) {
    console.error('Groq API Error:', error)
    throw error
  }
}

export async function generateCFOInsights(context: ForecastContext): Promise<string> {
  try {
    const contextText = buildFinancialContext(context)

    const prompt = `You are a seasoned CFO analyzing a cash forecast.

CRITICAL RULES:
1. Use ONLY the data provided below
2. If data is missing, explicitly state what's missing
3. Do NOT fabricate numbers, dates, or facts
4. Focus on actionable operational advice

FINANCIAL DATA:
${contextText}

Provide a concise CFO Executive Summary with:

**Liquidity Status** (2-3 bullets)
- Identify the critical cash point and timing
- Flag any threshold breaches
- Assess overall liquidity health

**Key Risks** (2-3 bullets)
- Highlight timing-specific risks (which weeks are most dangerous and why)
- Note any payroll or operational risks
- Call out anomalies if significant

**Recommended Actions** (1-2 bullets)
- Provide specific, operationally realistic recommendations
- Focus on timing and priorities

Keep it executive-ready: clear, concise, and action-oriented.`

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
  const { forecast, kpis, anomalies } = context

  let text = `=== CASH FORECAST SUMMARY (13 WEEKS) ===\n\n`

  text += `WEEKLY CASH POSITION:\n`
  forecast.forEach((week) => {
    const flags = []
    if (week.week === kpis.lowestWeek) flags.push('LOWEST CASH POINT')
    if (week.balance < 50000) flags.push('BELOW SAFETY THRESHOLD')

    const flagStr = flags.length > 0 ? ` ⚠️ ${flags.join(', ')}` : ''
    text += `Week ${week.week}: Net $${week.net.toLocaleString()} | Ending Cash $${week.balance.toLocaleString()}${flagStr}\n`
  })

  text += `\n=== KEY PERFORMANCE INDICATORS ===\n`
  text += `Lowest Cash Point: Week ${kpis.lowestWeek} at $${kpis.lowestCash.toLocaleString()}\n`
  text += `Weeks of Runway: ${kpis.runway.toFixed(1)} weeks\n`
  text += `Weeks Below Threshold: ${kpis.belowThreshold} weeks\n`
  text += `Payroll Risk Weeks: ${kpis.payrollRisk} weeks\n`
  text += `Cash Flow Volatility: ${kpis.volatility} (σ=$${kpis.volatilityScore.toLocaleString()})\n`
  text += `Average Burn Rate: $${kpis.burnRate.toLocaleString()}/week\n`

  if (anomalies && anomalies.length > 0) {
    text += `\n=== DETECTED ANOMALIES (>±20% from average) ===\n`
    anomalies.forEach((anom) => {
      text += `${anom.category}: $${anom.amount.toLocaleString()} (${anom.deviation > 0 ? '+' : ''}${anom.deviation.toFixed(1)}% deviation)\n`
    })
  } else {
    text += `\n=== ANOMALIES ===\nNo significant anomalies detected.\n`
  }

  return text
}

