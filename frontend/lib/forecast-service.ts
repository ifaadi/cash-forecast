import { supabase } from './supabase'

export interface ForecastWeek {
  week_number: number
  week_date: string
  inflow: number
  outflow: number
  net: number
  balance: number
  notes?: string
}

export interface Forecast {
  id: string
  user_id: string
  name: string
  start_date: string
  weeks: number
  starting_balance: number
  revenue_confidence: number
  expense_buffer: number
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface ForecastWithWeeks extends Forecast {
  forecast_weeks: ForecastWeek[]
}

// Generate forecast data based on parameters
export function generateForecastWeeks(
  params: {
    weeks: number
    startDate: string
    startingBalance: number
    revenueConfidence: number
    expenseBuffer: number
  }
): ForecastWeek[] {
  const { weeks, startDate, startingBalance, revenueConfidence, expenseBuffer } = params
  const forecast: ForecastWeek[] = []
  let balance = startingBalance
  const start = new Date(startDate)

  for (let week = 1; week <= weeks; week++) {
    const weekDate = new Date(start)
    weekDate.setDate(start.getDate() + (week - 1) * 7)

    // Base inflow: ~$900K per week with variation
    const baseInflow = 900000 + (Math.random() * 100000 - 50000)
    // Base outflow: $1M (even weeks) or $400K (odd weeks)
    const baseOutflow = week % 2 === 0 ? 1000000 : 400000
    // Additional large expense every 4 weeks: $300K
    const additionalExpense = week % 4 === 0 ? 300000 : 0

    const inflow = Math.round(baseInflow * (revenueConfidence / 100))
    const outflow = Math.round((baseOutflow + additionalExpense) * (expenseBuffer / 100))
    const net = inflow - outflow
    balance += net

    forecast.push({
      week_number: week,
      week_date: weekDate.toISOString().split('T')[0],
      inflow,
      outflow,
      net,
      balance: Math.round(balance),
    })
  }

  return forecast
}

// Get active forecast for user or create default
export async function getOrCreateActiveForecast(userId: string): Promise<ForecastWithWeeks | null> {
  try {
    // Try to get active forecast
    const { data: existingForecast, error: fetchError } = await supabase
      .from('forecasts')
      .select(`
        *,
        forecast_weeks (*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingForecast && !fetchError) {
      return existingForecast as ForecastWithWeeks
    }

    // Create default forecast if none exists
    const today = new Date().toISOString().split('T')[0]
    const newForecast = {
      user_id: userId,
      name: 'Default Forecast',
      start_date: today,
      weeks: 13,
      starting_balance: 5000000,
      revenue_confidence: 100,
      expense_buffer: 100,
      is_active: true,
    }

    const { data: createdForecast, error: createError } = await supabase
      .from('forecasts')
      .insert([newForecast])
      .select()
      .single()

    if (createError) throw createError

    // Generate and save forecast weeks
    const weeks = generateForecastWeeks({
      weeks: 13,
      startDate: today,
      startingBalance: 5000000,
      revenueConfidence: 100,
      expenseBuffer: 100,
    })

    const weekData = weeks.map(week => ({
      forecast_id: createdForecast.id,
      ...week,
    }))

    const { error: weeksError } = await supabase
      .from('forecast_weeks')
      .insert(weekData)

    if (weeksError) throw weeksError

    // Fetch the complete forecast with weeks
    const { data: completeForecast } = await supabase
      .from('forecasts')
      .select(`
        *,
        forecast_weeks (*)
      `)
      .eq('id', createdForecast.id)
      .single()

    return completeForecast as ForecastWithWeeks
  } catch (error) {
    console.error('Error in getOrCreateActiveForecast:', error)
    return null
  }
}

// Update forecast parameters and regenerate weeks
export async function updateForecast(
  forecastId: string,
  params: {
    revenue_confidence?: number
    expense_buffer?: number
    weeks?: number
    start_date?: string
  }
): Promise<ForecastWithWeeks | null> {
  try {
    // Update forecast record
    const { data: forecast, error: updateError } = await supabase
      .from('forecasts')
      .update(params)
      .eq('id', forecastId)
      .select()
      .single()

    if (updateError) throw updateError

    // Delete existing weeks
    await supabase
      .from('forecast_weeks')
      .delete()
      .eq('forecast_id', forecastId)

    // Generate new weeks
    const weeks = generateForecastWeeks({
      weeks: params.weeks || forecast.weeks,
      startDate: params.start_date || forecast.start_date,
      startingBalance: forecast.starting_balance,
      revenueConfidence: params.revenue_confidence || forecast.revenue_confidence,
      expenseBuffer: params.expense_buffer || forecast.expense_buffer,
    })

    const weekData = weeks.map(week => ({
      forecast_id: forecastId,
      ...week,
    }))

    await supabase
      .from('forecast_weeks')
      .insert(weekData)

    // Fetch updated forecast
    const { data: updatedForecast } = await supabase
      .from('forecasts')
      .select(`
        *,
        forecast_weeks (*)
      `)
      .eq('id', forecastId)
      .single()

    return updatedForecast as ForecastWithWeeks
  } catch (error) {
    console.error('Error updating forecast:', error)
    return null
  }
}

// Save scenario
export async function saveScenario(
  userId: string,
  forecastId: string,
  name: string,
  description: string,
  revenueAdjustment: number,
  expenseAdjustment: number
) {
  return await supabase
    .from('scenarios')
    .insert([{
      user_id: userId,
      forecast_id: forecastId,
      name,
      description,
      revenue_adjustment: revenueAdjustment,
      expense_adjustment: expenseAdjustment,
    }])
    .select()
    .single()
}

// Get all scenarios for user
export async function getUserScenarios(userId: string) {
  return await supabase
    .from('scenarios')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
}
