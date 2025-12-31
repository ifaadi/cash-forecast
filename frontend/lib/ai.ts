// AI Service for Gemini Integration
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyDub7S0CpV9RJGvFKieo31UEbXVRS95lzE'

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

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

export async function generateCFOInsights(context: ForecastContext): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const contextText = buildFinancialContext(context)

    const prompt = `You are a seasoned CFO analyzing a 13-week cash forecast.

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

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error: any) {
    console.error('Gemini AI Error:', error)
    const errorMsg = error?.message || error?.toString() || 'Unknown error'
    return `Unable to generate AI insights. Error: ${errorMsg}\n\nPlease ensure your Gemini API key is set in Vercel environment variables as NEXT_PUBLIC_GEMINI_API_KEY.`
  }
}

export async function askCFO(question: string, context: ForecastContext): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const contextText = buildFinancialContext(context)

    const prompt = `You are a CFO assistant answering questions about cash flow.

CRITICAL: Answer ONLY using the financial data below. If the answer isn't in the data, say so.

FINANCIAL DATA:
${contextText}

USER QUESTION:
${question}

Provide a clear, concise answer based ONLY on the data above. If you cannot answer from the data provided, explain what information is missing.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error: any) {
    console.error('Gemini AI Error:', error)
    const errorMsg = error?.message || error?.toString() || 'Unknown error'
    return `Sorry, I encountered an error: ${errorMsg}\n\nPlease ensure your Gemini API key is set in Vercel environment variables as NEXT_PUBLIC_GEMINI_API_KEY.`
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

export async function* streamCFOResponse(question: string, context: ForecastContext) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const contextText = buildFinancialContext(context)

    const prompt = `You are a CFO assistant answering questions about cash flow.

CRITICAL: Answer ONLY using the financial data below. If the answer isn't in the data, say so.

FINANCIAL DATA:
${contextText}

USER QUESTION:
${question}

Provide a clear, concise answer based ONLY on the data above.`

    const result = await model.generateContentStream(prompt)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      yield text
    }
  } catch (error: any) {
    console.error('Streaming Error:', error)
    const errorMsg = error?.message || error?.toString() || 'Unknown error'
    yield `Sorry, I encountered an error: ${errorMsg}. Please ensure your Gemini API key is configured correctly.`
  }
}
