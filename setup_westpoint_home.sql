-- Setup for Westpoint Home Company
-- Run this in Supabase SQL Editor

-- Step 1: Create Westpoint Home company (if not exists)
INSERT INTO public.companies (id, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Westpoint Home',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Update all @wphome.com users to link to Westpoint Home
UPDATE public.user_profiles
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE email LIKE '%@wphome.com'
  AND company_id IS NULL;

-- Step 3: Create forecast for Westpoint Home
DO $$
DECLARE
  v_company_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  v_user_id UUID;
  v_forecast_id UUID;
  v_start_date DATE := CURRENT_DATE;
  v_balance BIGINT := 5000000;
  v_week INT;
  v_inflow BIGINT;
  v_outflow BIGINT;
  v_net BIGINT;
BEGIN
  -- Get first user ID for this company
  SELECT id INTO v_user_id
  FROM public.user_profiles
  WHERE company_id = v_company_id
  LIMIT 1;

  -- Delete any existing forecasts for this company
  DELETE FROM forecasts WHERE company_id = v_company_id;

  -- Create new forecast
  INSERT INTO forecasts (company_id, name, start_date, weeks, starting_balance, revenue_confidence, expense_buffer, is_active)
  VALUES (v_company_id, 'Westpoint Home Forecast', v_start_date, 13, 5000000, 100, 100, true)
  RETURNING id INTO v_forecast_id;

  -- Generate 13 weeks of forecast data
  FOR v_week IN 1..13 LOOP
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

  -- Generate sample transactions
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

  RAISE NOTICE 'Setup complete for Westpoint Home!';
END $$;

-- Show results
SELECT 'Companies' as table_name, COUNT(*) as count FROM public.companies
UNION ALL
SELECT 'User Profiles with company_id', COUNT(*) FROM public.user_profiles WHERE company_id IS NOT NULL
UNION ALL
SELECT 'Forecasts', COUNT(*) FROM forecasts
UNION ALL
SELECT 'Forecast Weeks', COUNT(*) FROM forecast_weeks
UNION ALL
SELECT 'Transactions', COUNT(*) FROM public.transactions;
