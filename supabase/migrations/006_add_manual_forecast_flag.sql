-- Add is_manual flag to forecast_weeks table
-- This allows tracking whether a forecast week was manually entered or auto-generated from sliders
-- Manual forecasts take precedence over auto-generated ones in comparisons

ALTER TABLE forecast_weeks
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN forecast_weeks.is_manual IS 'Indicates if this forecast week was manually entered (true) or auto-generated from sliders (false). Manual forecasts override auto-generated ones.';

-- Create index for faster queries filtering by manual forecasts
CREATE INDEX IF NOT EXISTS idx_forecast_weeks_manual ON forecast_weeks(forecast_id, is_manual) WHERE is_manual = true;
