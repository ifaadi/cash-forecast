import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client only if env vars are available (handles build-time vs runtime)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          role: 'ADMIN' | 'USER'
          company_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'ADMIN' | 'USER'
          company_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'ADMIN' | 'USER'
          company_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          opening_cash: number
          safety_threshold: number
          payroll_threshold: number
          forecast_weeks: number
          created_at: string
          updated_at: string
        }
      }
      transactions: {
        Row: {
          id: string
          company_id: string
          transaction_date: string
          category: string
          type: 'Inflow' | 'Outflow'
          amount: number
          description: string | null
          is_recurring: boolean
          created_at: string
        }
      }
    }
  }
}
