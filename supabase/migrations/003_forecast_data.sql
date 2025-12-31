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
