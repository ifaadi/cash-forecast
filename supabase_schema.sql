-- ==========================================
-- AI-Enabled CFO Cash Forecasting System
-- Supabase Database Schema
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. USERS & ROLES TABLE
-- ==========================================
-- Note: Supabase Auth handles user authentication
-- This table extends auth.users with app-specific metadata

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Make first user admin (trigger)
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN
        NEW.role := 'ADMIN';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_first_user_is_admin
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION make_first_user_admin();

-- ==========================================
-- 2. COMPANY SETTINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    opening_cash NUMERIC DEFAULT 250000,
    safety_threshold NUMERIC DEFAULT 50000,
    payroll_threshold NUMERIC DEFAULT 30000,
    forecast_weeks INTEGER DEFAULT 13,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. TRANSACTIONS (Cash Inflows/Outflows)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Inflow', 'Outflow')),
    amount NUMERIC NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_company ON public.transactions(company_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);

-- ==========================================
-- 4. FORECAST SCENARIOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    scenario_name TEXT NOT NULL,
    revenue_confidence NUMERIC DEFAULT 100,
    expense_buffer NUMERIC DEFAULT 100,
    forecast_data JSONB,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scenarios_company ON public.scenarios(company_id);

-- ==========================================
-- 5. FORECAST RESULTS (Cached Computations)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL,
    scenario_name TEXT NOT NULL,
    forecast_data JSONB NOT NULL,
    kpi_data JSONB,
    anomalies JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forecasts_company ON public.forecasts(company_id);

-- ==========================================
-- 6. CHAT HISTORY (Ask the CFO)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    context_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_company ON public.chat_history(company_id);
CREATE INDEX idx_chat_user ON public.chat_history(user_id);

-- ==========================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can only see their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Companies: Users can only access their company
CREATE POLICY "Users can view own company" ON public.companies
    FOR SELECT USING (
        id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update company" ON public.companies
    FOR UPDATE USING (
        id IN (
            SELECT company_id FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can insert company" ON public.companies
    FOR INSERT WITH CHECK (TRUE);

-- Transactions: Users can view company transactions
CREATE POLICY "Users can view company transactions" ON public.transactions
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert transactions" ON public.transactions
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can update transactions" ON public.transactions
    FOR UPDATE USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can delete transactions" ON public.transactions
    FOR DELETE USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- Scenarios: Users can view company scenarios
CREATE POLICY "Users can view company scenarios" ON public.scenarios
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert scenarios" ON public.scenarios
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- Forecasts: Users can view company forecasts
CREATE POLICY "Users can view company forecasts" ON public.forecasts
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert forecasts" ON public.forecasts
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- Chat History: Users can view own chat history
CREATE POLICY "Users can view company chat" ON public.chat_history
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert chat" ON public.chat_history
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- ==========================================
-- 8. UPDATED_AT TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
