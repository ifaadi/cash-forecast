-- Add safety_threshold column to forecasts table
-- This allows CFOs to set their own cash safety threshold based on:
-- - Monthly operating expenses (typically 3-6 months runway)
-- - Industry volatility
-- - Debt obligations
-- - Seasonal fluctuations
-- - Growth plans & capital needs

ALTER TABLE forecasts
ADD COLUMN IF NOT EXISTS safety_threshold BIGINT NOT NULL DEFAULT 1000000;

-- Add comment to explain the field
COMMENT ON COLUMN forecasts.safety_threshold IS 'Minimum cash balance threshold in cents. Default $1M. CFOs can adjust based on their specific business needs.';
