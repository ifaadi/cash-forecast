-- Create forecasts table for storing cash flow forecasts
CREATE TABLE IF NOT EXISTS forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create forecast_weeks table for detailed week-by-week data
CREATE TABLE IF NOT EXISTS forecast_weeks (
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

-- Create scenarios table for scenario planning
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES forecasts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  revenue_adjustment INTEGER DEFAULT 100,
  expense_adjustment INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_forecasts_user_id ON forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_active ON forecasts(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_forecast_weeks_forecast_id ON forecast_weeks(forecast_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios(user_id);

-- Enable Row Level Security
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for forecasts
CREATE POLICY "Users can view their own forecasts"
  ON forecasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own forecasts"
  ON forecasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forecasts"
  ON forecasts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forecasts"
  ON forecasts FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for forecast_weeks
CREATE POLICY "Users can view forecast weeks for their forecasts"
  ON forecast_weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forecasts
      WHERE forecasts.id = forecast_weeks.forecast_id
      AND forecasts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert forecast weeks for their forecasts"
  ON forecast_weeks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forecasts
      WHERE forecasts.id = forecast_weeks.forecast_id
      AND forecasts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update forecast weeks for their forecasts"
  ON forecast_weeks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forecasts
      WHERE forecasts.id = forecast_weeks.forecast_id
      AND forecasts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete forecast weeks for their forecasts"
  ON forecast_weeks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forecasts
      WHERE forecasts.id = forecast_weeks.forecast_id
      AND forecasts.user_id = auth.uid()
    )
  );

-- Create RLS policies for scenarios
CREATE POLICY "Users can view their own scenarios"
  ON scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios"
  ON scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for forecasts
CREATE TRIGGER update_forecasts_updated_at BEFORE UPDATE ON forecasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add dummy transaction data for demonstration
-- This will auto-populate sample transactions for new users

-- Function to generate dummy transactions for a company
CREATE OR REPLACE FUNCTION generate_dummy_transactions(p_company_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_start_date DATE := CURRENT_DATE - INTERVAL '90 days';
  v_date DATE;
  v_week INT;
BEGIN
  -- Clear any existing dummy data
  DELETE FROM public.transactions WHERE company_id = p_company_id;

  -- Generate 13 weeks of transaction data
  FOR v_week IN 1..13 LOOP
    v_date := v_start_date + (v_week - 1) * INTERVAL '7 days';

    -- Revenue - Sales (weekly)
    INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
    VALUES (
      p_company_id,
      v_date,
      'Revenue - Sales',
      'Inflow',
      850000 + (RANDOM() * 100000)::NUMERIC,
      'Weekly sales revenue',
      p_user_id
    );

    -- Revenue - Services (weekly)
    INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
    VALUES (
      p_company_id,
      v_date + INTERVAL '2 days',
      'Revenue - Services',
      'Inflow',
      50000 + (RANDOM() * 20000)::NUMERIC,
      'Service contracts payment',
      p_user_id
    );

    -- Expense - Payroll (biweekly)
    IF v_week % 2 = 0 THEN
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by, is_recurring)
      VALUES (
        p_company_id,
        v_date + INTERVAL '5 days',
        'Expense - Payroll',
        'Outflow',
        750000,
        'Biweekly payroll',
        p_user_id,
        true
      );
    END IF;

    -- Expense - Operations (weekly)
    INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
    VALUES (
      p_company_id,
      v_date + INTERVAL '3 days',
      'Expense - Operations',
      'Outflow',
      150000 + (RANDOM() * 50000)::NUMERIC,
      'Weekly operational expenses',
      p_user_id
    );

    -- Expense - Marketing (weekly)
    INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
    VALUES (
      p_company_id,
      v_date + INTERVAL '1 day',
      'Expense - Marketing',
      'Outflow',
      80000 + (RANDOM() * 30000)::NUMERIC,
      'Marketing and advertising',
      p_user_id
    );

    -- Expense - Rent (monthly - week 1, 5, 9, 13)
    IF v_week % 4 = 1 THEN
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by, is_recurring)
      VALUES (
        p_company_id,
        v_date,
        'Expense - Rent',
        'Outflow',
        300000,
        'Monthly office rent',
        p_user_id,
        true
      );
    END IF;

    -- Expense - Utilities (monthly)
    IF v_week % 4 = 2 THEN
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
      VALUES (
        p_company_id,
        v_date + INTERVAL '4 days',
        'Expense - Utilities',
        'Outflow',
        25000 + (RANDOM() * 10000)::NUMERIC,
        'Monthly utilities',
        p_user_id
      );
    END IF;

    -- Revenue - Other (occasional)
    IF v_week % 3 = 0 THEN
      INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
      VALUES (
        p_company_id,
        v_date + INTERVAL '6 days',
        'Revenue - Other',
        'Inflow',
        30000 + (RANDOM() * 40000)::NUMERIC,
        'Miscellaneous income',
        p_user_id
      );
    END IF;

    -- Expense - Supplies (weekly)
    INSERT INTO public.transactions (company_id, transaction_date, category, type, amount, description, created_by)
    VALUES (
      p_company_id,
      v_date + INTERVAL '2 days',
      'Expense - Supplies',
      'Outflow',
      20000 + (RANDOM() * 15000)::NUMERIC,
      'Office supplies and materials',
      p_user_id
    );

  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate dummy data when a new company is created
CREATE OR REPLACE FUNCTION auto_generate_dummy_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate dummy data if this is a new company and no transactions exist
  IF (SELECT COUNT(*) FROM public.transactions WHERE company_id = NEW.id) = 0 THEN
    -- Get the first user of this company
    PERFORM generate_dummy_transactions(
      NEW.id,
      (SELECT id FROM public.user_profiles WHERE company_id = NEW.id LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_dummy_data
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION auto_generate_dummy_data();

-- Also create a manual function users can call to regenerate dummy data
CREATE OR REPLACE FUNCTION regenerate_dummy_data()
RETURNS VOID AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user's company
  SELECT company_id INTO v_company_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    PERFORM generate_dummy_transactions(v_company_id, auth.uid());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
