-- Complete Setup with Sample Data
-- Run this ONCE in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop existing tables (clean slate)
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_generate_dummy_data ON public.companies;
DROP TABLE IF EXISTS forecast_weeks CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS forecasts CASCADE;

-- ============================================
-- STEP 2: Create tables
-- ============================================

-- Forecasts table
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  weeks INTEGER NOT NULL DEFAULT 13,
  starting_balance BIGINT NOT NULL DEFAULT 5000000,
  revenue_confidence INTEGER NOT NULL DEFAULT 100,
  expense_buffer INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Forecast weeks table
CREATE TABLE forecast_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_date DATE NOT NULL,
  inflow BIGINT NOT NULL DEFAULT 0,
  outflow BIGINT NOT NULL DEFAULT 0,
  net BIGINT NOT NULL DEFAULT 0,
  balance BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_forecast_week UNIQUE(forecast_id, week_number)
);

-- Scenarios table
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES forecasts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  revenue_adjustment INTEGER DEFAULT 100,
  expense_adjustment INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create indexes
-- ============================================
CREATE INDEX idx_forecasts_company_id ON forecasts(company_id);
CREATE INDEX idx_forecasts_active ON forecasts(company_id, is_active) WHERE is_active = true;
CREATE INDEX idx_forecast_weeks_forecast_id ON forecast_weeks(forecast_id);
CREATE INDEX idx_scenarios_company_id ON scenarios(company_id);

-- ============================================
-- STEP 4: Enable RLS
-- ============================================
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Create RLS Policies
-- ============================================

-- Forecasts policies
CREATE POLICY "Users can view company forecasts"
  ON forecasts FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company forecasts"
  ON forecasts FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company forecasts"
  ON forecasts FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company forecasts"
  ON forecasts FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

-- Forecast weeks policies
CREATE POLICY "Users can view company forecast weeks"
  ON forecast_weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forecasts f
      INNER JOIN public.user_profiles up ON up.company_id = f.company_id
      WHERE f.id = forecast_weeks.forecast_id AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert company forecast weeks"
  ON forecast_weeks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forecasts f
      INNER JOIN public.user_profiles up ON up.company_id = f.company_id
      WHERE f.id = forecast_weeks.forecast_id AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can update company forecast weeks"
  ON forecast_weeks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forecasts f
      INNER JOIN public.user_profiles up ON up.company_id = f.company_id
      WHERE f.id = forecast_weeks.forecast_id AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete company forecast weeks"
  ON forecast_weeks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forecasts f
      INNER JOIN public.user_profiles up ON up.company_id = f.company_id
      WHERE f.id = forecast_weeks.forecast_id AND up.id = auth.uid()
    )
  );

-- Scenarios policies
CREATE POLICY "Users can view company scenarios"
  ON scenarios FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company scenarios"
  ON scenarios FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company scenarios"
  ON scenarios FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company scenarios"
  ON scenarios FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

-- ============================================
-- STEP 6: Create trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_forecasts_updated_at BEFORE UPDATE ON forecasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 7: Populate with sample data for ALL users
-- ============================================

DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_forecast_id UUID;
  v_start_date DATE := CURRENT_DATE;
  v_balance BIGINT := 5000000;
  v_week INT;
  v_inflow BIGINT;
  v_outflow BIGINT;
  v_net BIGINT;
BEGIN
  -- Loop through all companies
  FOR v_company_id, v_user_id IN
    SELECT DISTINCT up.company_id, up.id
    FROM public.user_profiles up
    WHERE up.company_id IS NOT NULL
  LOOP
    -- Create forecast for this company
    INSERT INTO forecasts (company_id, name, start_date, weeks, starting_balance, revenue_confidence, expense_buffer, is_active)
    VALUES (v_company_id, 'Default Forecast', v_start_date, 13, 5000000, 100, 100, true)
    RETURNING id INTO v_forecast_id;

    -- Generate 13 weeks of forecast data
    v_balance := 5000000;
    FOR v_week IN 1..13 LOOP
      -- Calculate inflows and outflows with variation
      v_inflow := 900000 + (RANDOM() * 100000 - 50000)::BIGINT;

      IF v_week % 2 = 0 THEN
        v_outflow := 1000000;
      ELSE
        v_outflow := 400000;
      END IF;

      IF v_week % 4 = 0 THEN
        v_outflow := v_outflow + 300000;
      END IF;

      v_net := v_inflow - v_outflow;
      v_balance := v_balance + v_net;

      INSERT INTO forecast_weeks (forecast_id, week_number, week_date, inflow, outflow, net, balance)
      VALUES (
        v_forecast_id,
        v_week,
        v_start_date + (v_week - 1) * INTERVAL '7 days',
        v_inflow,
        v_outflow,
        v_net,
        v_balance
      );
    END LOOP;

    -- Generate sample transactions for this company
    DELETE FROM public.transactions WHERE company_id = v_company_id;

    FOR v_week IN 1..13 LOOP
      -- Revenue - Sales (weekly)
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
      VALUES (
        v_company_id,
        v_start_date + (v_week - 1) * INTERVAL '7 days',
        'Revenue - Sales',
        'Inflow',
        850000 + (RANDOM() * 100000)::NUMERIC,
        'Weekly sales revenue',
        v_user_id
      );

      -- Revenue - Services
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
      VALUES (
        v_company_id,
        v_start_date + (v_week - 1) * INTERVAL '7 days' + INTERVAL '2 days',
        'Revenue - Services',
        'Inflow',
        50000 + (RANDOM() * 20000)::NUMERIC,
        'Service contracts payment',
        v_user_id
      );

      -- Expense - Payroll (biweekly)
      IF v_week % 2 = 0 THEN
        INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by, is_recurring)
        VALUES (
          v_company_id,
          v_start_date + (v_week - 1) * INTERVAL '7 days' + INTERVAL '5 days',
          'Expense - Payroll',
          'Outflow',
          750000,
          'Biweekly payroll',
          v_user_id,
          true
        );
      END IF;

      -- Expense - Operations (weekly)
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
      VALUES (
        v_company_id,
        v_start_date + (v_week - 1) * INTERVAL '7 days' + INTERVAL '3 days',
        'Expense - Operations',
        'Outflow',
        150000 + (RANDOM() * 50000)::NUMERIC,
        'Weekly operational expenses',
        v_user_id
      );

      -- Expense - Marketing (weekly)
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
      VALUES (
        v_company_id,
        v_start_date + (v_week - 1) * INTERVAL '7 days' + INTERVAL '1 day',
        'Expense - Marketing',
        'Outflow',
        80000 + (RANDOM() * 30000)::NUMERIC,
        'Marketing and advertising',
        v_user_id
      );

      -- Expense - Rent (monthly)
      IF v_week % 4 = 1 THEN
        INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by, is_recurring)
        VALUES (
          v_company_id,
          v_start_date + (v_week - 1) * INTERVAL '7 days',
          'Expense - Rent',
          'Outflow',
          200000,
          'Monthly office rent',
          v_user_id,
          true
        );
      END IF;

      -- Expense - Utilities (monthly)
      IF v_week % 4 = 1 THEN
        INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
        VALUES (
          v_company_id,
          v_start_date + (v_week - 1) * INTERVAL '7 days' + INTERVAL '4 days',
          'Expense - Utilities',
          'Outflow',
          15000 + (RANDOM() * 5000)::NUMERIC,
          'Utilities and services',
          v_user_id
        );
      END IF;
    END LOOP;

  END LOOP;
END $$;

-- ============================================
-- Success message
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM forecasts;
  RAISE NOTICE 'Setup complete! Created % forecast(s) with sample data.', v_count;
END $$;
