"""
AI-Enabled CFO Cash Forecasting Command Center
Free/OSS-First Cloud Cash Forecasting System
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, timedelta, datetime
from typing import Dict, Any, Tuple, Optional
import json

# ==========================================
# IMPORTS (Conditional for graceful degradation)
# ==========================================
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# ==========================================
# PAGE CONFIGURATION
# ==========================================
st.set_page_config(
    page_title="CFO Cash Command Center",
    layout="wide",
    page_icon="💰",
    initial_sidebar_state="expanded"
)

# ==========================================
# CUSTOM CSS FOR MODERN DASHBOARD
# ==========================================
st.markdown("""
<style>
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
        text-align: center;
    }
    .warning-card {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
    }
    .success-card {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
    }
    .stButton>button {
        width: 100%;
    }
    h1 {
        color: #1f2937;
    }
    .risk-high {
        color: #dc2626;
        font-weight: bold;
    }
    .risk-medium {
        color: #f59e0b;
        font-weight: bold;
    }
    .risk-low {
        color: #10b981;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# SUPABASE CONNECTION
# ==========================================
@st.cache_resource
def init_supabase() -> Optional[Client]:
    """Initialize Supabase client with credentials from secrets"""
    if not SUPABASE_AVAILABLE:
        return None

    try:
        supabase_url = st.secrets.get("SUPABASE_URL", "")
        supabase_key = st.secrets.get("SUPABASE_KEY", "")

        if supabase_url and supabase_key:
            return create_client(supabase_url, supabase_key)
        return None
    except Exception as e:
        st.error(f"Supabase connection error: {e}")
        return None

supabase = init_supabase()

# ==========================================
# AUTHENTICATION FUNCTIONS
# ==========================================
def login_user(email: str, password: str) -> Tuple[bool, Optional[str]]:
    """Authenticate user with Supabase Auth"""
    if not supabase:
        return False, "Database not configured"

    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if response.user:
            # Store user info in session
            st.session_state.user = response.user
            st.session_state.user_email = response.user.email
            st.session_state.authenticated = True

            # Get user profile
            profile = supabase.table('user_profiles').select('*').eq('id', response.user.id).execute()
            if profile.data:
                st.session_state.user_role = profile.data[0]['role']
                st.session_state.company_id = profile.data[0]['company_id']

            return True, None
        return False, "Invalid credentials"
    except Exception as e:
        return False, str(e)

def register_user(email: str, password: str) -> Tuple[bool, Optional[str]]:
    """Register new user with Supabase Auth"""
    if not supabase:
        return False, "Database not configured"

    try:
        # Sign up with Supabase Auth
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        if response.user:
            # Check if this is the first user
            profiles_count = supabase.table('user_profiles').select('id', count='exact').execute()
            is_first_user = profiles_count.count == 0

            # Create user profile (first user becomes ADMIN)
            role = 'ADMIN' if is_first_user else 'USER'

            # Create default company for first user
            company_id = None
            if is_first_user:
                company = supabase.table('companies').insert({
                    'name': 'Default Company',
                    'opening_cash': 250000,
                    'safety_threshold': 50000
                }).execute()
                company_id = company.data[0]['id'] if company.data else None

            # Insert user profile
            supabase.table('user_profiles').insert({
                'id': response.user.id,
                'email': email,
                'role': role,
                'company_id': company_id
            }).execute()

            return True, f"Account created! Role: {role}"
        return False, "Registration failed"
    except Exception as e:
        return False, str(e)

def logout_user():
    """Logout current user"""
    if supabase:
        try:
            supabase.auth.sign_out()
        except:
            pass

    # Clear session
    for key in ['user', 'user_email', 'authenticated', 'user_role', 'company_id']:
        if key in st.session_state:
            del st.session_state[key]

# ==========================================
# DATA GENERATION & LOADING
# ==========================================
def get_default_transactions(company_id: Optional[str] = None) -> pd.DataFrame:
    """Generate default 13-week transaction data"""
    dates = [date.today() + timedelta(weeks=i) for i in range(13)]
    data = []

    for i, d in enumerate(dates):
        # Weekly sales revenue
        data.append({
            "company_id": company_id,
            "transaction_date": d,
            "category": "Sales Revenue",
            "type": "Inflow",
            "amount": 45000 + np.random.randint(-5000, 5000),
            "description": "Weekly sales"
        })

        # Customer payments (AR collections)
        if i % 2 == 0:
            data.append({
                "company_id": company_id,
                "transaction_date": d,
                "category": "AR Collections",
                "type": "Inflow",
                "amount": 25000 + np.random.randint(-3000, 3000),
                "description": "Customer payments"
            })

        # Operating expenses
        data.append({
            "company_id": company_id,
            "transaction_date": d,
            "category": "Operating Expenses",
            "type": "Outflow",
            "amount": 12000 + np.random.randint(-2000, 2000),
            "description": "Weekly OPEX"
        })

        # Payroll (bi-weekly)
        if i % 2 == 0:
            data.append({
                "company_id": company_id,
                "transaction_date": d,
                "category": "Payroll",
                "type": "Outflow",
                "amount": 38000 + np.random.randint(-2000, 2000),
                "description": "Bi-weekly payroll"
            })

        # Vendor payments (weekly)
        data.append({
            "company_id": company_id,
            "transaction_date": d,
            "category": "Vendor Payments",
            "type": "Outflow",
            "amount": 8000 + np.random.randint(-1000, 1000),
            "description": "Supplier payments"
        })

        # Rent (monthly - week 0, 4, 8, 12)
        if i % 4 == 0:
            data.append({
                "company_id": company_id,
                "transaction_date": d,
                "category": "Rent",
                "type": "Outflow",
                "amount": 15000,
                "description": "Monthly rent"
            })

    return pd.DataFrame(data)

def load_transactions(company_id: str) -> pd.DataFrame:
    """Load transactions from Supabase or return default data"""
    if not supabase or not company_id:
        return get_default_transactions()

    try:
        response = supabase.table('transactions').select('*').eq('company_id', company_id).execute()

        if response.data and len(response.data) > 0:
            df = pd.DataFrame(response.data)
            df['transaction_date'] = pd.to_datetime(df['transaction_date']).dt.date
            return df
        else:
            # No data, create and save defaults
            default_data = get_default_transactions(company_id)
            # Save to DB
            records = default_data.to_dict('records')
            for record in records:
                record['transaction_date'] = record['transaction_date'].isoformat()
            supabase.table('transactions').insert(records).execute()
            return default_data
    except Exception as e:
        st.warning(f"Could not load transactions: {e}")
        return get_default_transactions(company_id)

def get_company_settings(company_id: str) -> Dict[str, Any]:
    """Load company settings from Supabase"""
    if not supabase or not company_id:
        return {
            'opening_cash': 250000,
            'safety_threshold': 50000,
            'payroll_threshold': 30000,
            'forecast_weeks': 13
        }

    try:
        response = supabase.table('companies').select('*').eq('id', company_id).single().execute()
        if response.data:
            return response.data
    except:
        pass

    return {
        'opening_cash': 250000,
        'safety_threshold': 50000,
        'payroll_threshold': 30000,
        'forecast_weeks': 13
    }

# ==========================================
# FORECAST ENGINE (13-Week Direct Method)
# ==========================================
def calculate_13_week_forecast(
    transactions_df: pd.DataFrame,
    opening_cash: float,
    revenue_confidence: float = 100,
    expense_buffer: float = 100
) -> pd.DataFrame:
    """
    Calculate 13-week direct-method cash forecast

    Args:
        transactions_df: Raw transaction data
        opening_cash: Starting cash balance
        revenue_confidence: % multiplier for inflows (70-110%)
        expense_buffer: % multiplier for outflows (90-150%)

    Returns:
        DataFrame with weekly forecast including Balance, Net, Inflow, Outflow
    """
    df = transactions_df.copy()
    df['transaction_date'] = pd.to_datetime(df['transaction_date'])

    # Apply scenario adjustments
    df.loc[df['type'] == 'Inflow', 'amount'] *= (revenue_confidence / 100)
    df.loc[df['type'] == 'Outflow', 'amount'] *= (expense_buffer / 100)

    # Group by week and type
    df_weekly = df.groupby([
        pd.Grouper(key='transaction_date', freq='W-MON'),
        'type'
    ])['amount'].sum().reset_index()

    # Pivot to get Inflow/Outflow columns
    df_pivot = df_weekly.pivot(
        index='transaction_date',
        columns='type',
        values='amount'
    ).fillna(0)

    # Ensure columns exist
    for col in ['Inflow', 'Outflow']:
        if col not in df_pivot.columns:
            df_pivot[col] = 0

    # Calculate net flow and running balance
    df_pivot['Net'] = df_pivot['Inflow'] - df_pivot['Outflow']

    # Calculate cumulative balance
    df_pivot['Balance'] = opening_cash + df_pivot['Net'].cumsum()

    # Add week number
    df_pivot['Week'] = range(1, len(df_pivot) + 1)

    return df_pivot.reset_index()

# ==========================================
# SMART KPIs CALCULATION
# ==========================================
def calculate_kpis(
    forecast_df: pd.DataFrame,
    safety_threshold: float,
    payroll_threshold: float,
    transactions_df: pd.DataFrame
) -> Dict[str, Any]:
    """
    Calculate all Smart KPIs for executive dashboard

    Returns dict with:
    - lowest_cash_week, lowest_cash_value
    - weeks_of_runway
    - weeks_below_threshold
    - payroll_risk_weeks
    - volatility_score
    - best_case_delta, worst_case_delta
    - average_burn_rate
    """
    kpis = {}

    # 1. Lowest cash point
    min_idx = forecast_df['Balance'].idxmin()
    kpis['lowest_cash_week'] = int(forecast_df.loc[min_idx, 'Week'])
    kpis['lowest_cash_value'] = float(forecast_df.loc[min_idx, 'Balance'])

    # 2. Average burn rate (average negative net flow)
    negative_flows = forecast_df[forecast_df['Net'] < 0]['Net']
    if len(negative_flows) > 0:
        kpis['average_burn_rate'] = float(abs(negative_flows.mean()))
    else:
        kpis['average_burn_rate'] = 0

    # 3. Weeks of runway
    if kpis['average_burn_rate'] > 0:
        current_balance = forecast_df.iloc[0]['Balance']
        kpis['weeks_of_runway'] = float(current_balance / kpis['average_burn_rate'])
    else:
        kpis['weeks_of_runway'] = 99  # Infinite runway

    # 4. Weeks below safety threshold
    kpis['weeks_below_threshold'] = int((forecast_df['Balance'] < safety_threshold).sum())

    # 5. Payroll risk weeks (weeks with payroll where balance < threshold)
    payroll_weeks = transactions_df[
        (transactions_df['category'] == 'Payroll') &
        (transactions_df['type'] == 'Outflow')
    ]['transaction_date'].dt.to_period('W-MON').unique()

    risky_weeks = []
    for week_date in payroll_weeks:
        week_balance = forecast_df[
            forecast_df['transaction_date'].dt.to_period('W-MON') == week_date
        ]
        if not week_balance.empty and week_balance.iloc[0]['Balance'] < payroll_threshold:
            risky_weeks.append(week_date)

    kpis['payroll_risk_weeks'] = len(risky_weeks)
    kpis['payroll_risk_week_list'] = [str(w) for w in risky_weeks]

    # 6. Volatility score (std dev of weekly net flows)
    kpis['volatility_score'] = float(forecast_df['Net'].std())

    # Volatility rating
    if kpis['volatility_score'] < 10000:
        kpis['volatility_rating'] = 'Low'
    elif kpis['volatility_score'] < 25000:
        kpis['volatility_rating'] = 'Medium'
    else:
        kpis['volatility_rating'] = 'High'

    # 7. Best/Worst case scenarios (calculated separately with scenario planning)
    kpis['best_case_delta'] = 0
    kpis['worst_case_delta'] = 0

    return kpis

# ==========================================
# ANOMALY DETECTION
# ==========================================
def detect_anomalies(transactions_df: pd.DataFrame, threshold: float = 20) -> pd.DataFrame:
    """
    Detect anomalies: line items >±20% from historical average

    Args:
        transactions_df: Transaction data
        threshold: % deviation threshold (default 20%)

    Returns:
        DataFrame with anomalies
    """
    df = transactions_df.copy()

    # Calculate average by category
    avg_by_category = df.groupby(['category', 'type'])['amount'].mean().reset_index()
    avg_by_category.columns = ['category', 'type', 'avg_amount']

    # Merge with original data
    df = df.merge(avg_by_category, on=['category', 'type'], how='left')

    # Calculate % deviation
    df['pct_deviation'] = ((df['amount'] - df['avg_amount']) / df['avg_amount'] * 100)

    # Flag anomalies
    df['is_anomaly'] = abs(df['pct_deviation']) > threshold

    # Return only anomalies
    anomalies = df[df['is_anomaly']].copy()
    anomalies = anomalies.sort_values('pct_deviation', ascending=False)

    return anomalies[['transaction_date', 'category', 'type', 'amount', 'avg_amount', 'pct_deviation']]

# ==========================================
# DATA → PROMPT GROUNDING (CRITICAL)
# ==========================================
def build_financial_context(forecast_df: pd.DataFrame, kpi_dict: Dict, anomalies_df: pd.DataFrame) -> str:
    """
    CRITICAL: Convert computed results into compact text for LLM
    This prevents AI hallucinations by grounding responses in real data

    Args:
        forecast_df: Weekly forecast DataFrame
        kpi_dict: Computed KPIs dictionary
        anomalies_df: Detected anomalies DataFrame

    Returns:
        Condensed string summary for AI prompt
    """
    context_parts = []

    # Header
    context_parts.append("=== CASH FORECAST SUMMARY (13 WEEKS) ===\n")

    # Weekly breakdown (highlight key weeks)
    context_parts.append("WEEKLY CASH POSITION:")
    for _, row in forecast_df.iterrows():
        week_num = int(row['Week'])
        net_flow = row['Net']
        balance = row['Balance']

        # Flag important weeks
        flags = []
        if week_num == kpi_dict['lowest_cash_week']:
            flags.append("LOWEST CASH POINT")
        if balance < 50000:  # Below typical threshold
            flags.append("BELOW SAFETY THRESHOLD")

        flag_str = f" ⚠️ {', '.join(flags)}" if flags else ""

        context_parts.append(
            f"Week {week_num}: Net ${net_flow:,.0f} | Ending Cash ${balance:,.0f}{flag_str}"
        )

    # KPIs
    context_parts.append("\n=== KEY PERFORMANCE INDICATORS ===")
    context_parts.append(f"Lowest Cash Point: Week {kpi_dict['lowest_cash_week']} at ${kpi_dict['lowest_cash_value']:,.0f}")
    context_parts.append(f"Weeks of Runway: {kpi_dict['weeks_of_runway']:.1f} weeks")
    context_parts.append(f"Weeks Below Threshold: {kpi_dict['weeks_below_threshold']} weeks")
    context_parts.append(f"Payroll Risk Weeks: {kpi_dict['payroll_risk_weeks']} weeks")
    context_parts.append(f"Cash Flow Volatility: {kpi_dict['volatility_rating']} (σ=${kpi_dict['volatility_score']:,.0f})")
    context_parts.append(f"Average Burn Rate: ${kpi_dict['average_burn_rate']:,.0f}/week")

    # Anomalies
    if len(anomalies_df) > 0:
        context_parts.append("\n=== DETECTED ANOMALIES (>±20% from average) ===")
        for _, anom in anomalies_df.head(5).iterrows():
            context_parts.append(
                f"{anom['category']}: ${anom['amount']:,.0f} "
                f"({anom['pct_deviation']:+.1f}% vs avg ${anom['avg_amount']:,.0f})"
            )
    else:
        context_parts.append("\n=== ANOMALIES ===")
        context_parts.append("No significant anomalies detected.")

    return "\n".join(context_parts)

# ==========================================
# AI INSIGHTS (Grounded)
# ==========================================
def get_ai_insight(financial_context: str, gemini_api_key: Optional[str] = None) -> str:
    """
    Generate CFO-style insights using Gemini AI
    GROUNDED in computed financial data to prevent hallucinations

    Args:
        financial_context: Output from build_financial_context()
        gemini_api_key: Gemini API key (optional)

    Returns:
        AI-generated CFO narrative
    """
    if not GEMINI_AVAILABLE:
        return "⚠️ AI features require google-generativeai package. Install with: pip install google-generativeai"

    if not gemini_api_key:
        return "⚠️ Please provide a Gemini API key in Settings to enable AI insights."

    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-pro')

        prompt = f"""You are a seasoned CFO analyzing a 13-week cash forecast.

CRITICAL RULES:
1. Use ONLY the data provided below
2. If data is missing, explicitly state what's missing
3. Do NOT fabricate numbers, dates, or facts
4. Focus on actionable operational advice

FINANCIAL DATA:
{financial_context}

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

Keep it executive-ready: clear, concise, and action-oriented.
"""

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        return f"AI Error: {str(e)}\n\nPlease check your API key and try again."

# ==========================================
# CHAT INTERFACE (Ask the CFO)
# ==========================================
def ask_the_cfo(
    question: str,
    financial_context: str,
    gemini_api_key: Optional[str] = None
) -> str:
    """
    Answer user questions about the cash forecast
    Uses grounded financial context to prevent hallucinations

    Args:
        question: User's question
        financial_context: Grounded financial summary
        gemini_api_key: Gemini API key

    Returns:
        AI answer grounded in data
    """
    if not GEMINI_AVAILABLE or not gemini_api_key:
        return "⚠️ AI chat requires Gemini API key. Please configure in Settings."

    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-pro')

        prompt = f"""You are a CFO assistant answering questions about cash flow.

CRITICAL: Answer ONLY using the financial data below. If the answer isn't in the data, say so.

FINANCIAL DATA:
{financial_context}

USER QUESTION:
{question}

Provide a clear, concise answer based ONLY on the data above. If you cannot answer from the data provided, explain what information is missing.
"""

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        return f"Error: {str(e)}"

# ==========================================
# AUTHENTICATION UI
# ==========================================
def show_auth_page():
    """Display login/registration page"""
    st.title("💰 CFO Cash Command Center")
    st.subheader("AI-Enabled 13-Week Cash Forecasting")

    if not supabase:
        st.error("⚠️ Database not configured. Please set up Supabase credentials.")
        st.info("See README.md for setup instructions.")

        # Demo mode option
        if st.button("🚀 Try Demo Mode (No Auth)"):
            st.session_state.demo_mode = True
            st.session_state.authenticated = True
            st.session_state.user_role = 'ADMIN'
            st.session_state.company_id = 'demo'
            st.rerun()
        return

    tab1, tab2 = st.tabs(["Login", "Register"])

    with tab1:
        st.subheader("Login to Your Account")
        login_email = st.text_input("Email", key="login_email")
        login_password = st.text_input("Password", type="password", key="login_password")

        if st.button("Login", type="primary"):
            if login_email and login_password:
                success, error = login_user(login_email, login_password)
                if success:
                    st.success("Login successful!")
                    st.rerun()
                else:
                    st.error(f"Login failed: {error}")
            else:
                st.warning("Please enter email and password")

    with tab2:
        st.subheader("Create New Account")
        st.info("First user automatically becomes ADMIN")

        reg_email = st.text_input("Email", key="reg_email")
        reg_password = st.text_input("Password", type="password", key="reg_password")
        reg_password_confirm = st.text_input("Confirm Password", type="password", key="reg_password_confirm")

        if st.button("Register", type="primary"):
            if reg_email and reg_password:
                if reg_password == reg_password_confirm:
                    success, message = register_user(reg_email, reg_password)
                    if success:
                        st.success(message)
                        st.info("Please login with your new credentials")
                    else:
                        st.error(f"Registration failed: {message}")
                else:
                    st.error("Passwords do not match")
            else:
                st.warning("Please fill in all fields")

# ==========================================
# MAIN DASHBOARD
# ==========================================
def show_dashboard():
    """Main CFO Dashboard Interface"""

    # Sidebar
    with st.sidebar:
        st.header("⚙️ Control Panel")

        # User info
        user_email = st.session_state.get('user_email', 'Demo User')
        user_role = st.session_state.get('user_role', 'USER')
        st.info(f"👤 {user_email}\n\n🔐 Role: **{user_role}**")

        if st.button("🚪 Logout", type="secondary"):
            logout_user()
            st.rerun()

        st.divider()

        # Settings (Admin only or demo mode)
        company_id = st.session_state.get('company_id', 'demo')
        settings = get_company_settings(company_id)

        if user_role == 'ADMIN' or st.session_state.get('demo_mode'):
            st.subheader("💼 Company Settings")

            opening_cash = st.number_input(
                "Opening Cash ($)",
                value=float(settings.get('opening_cash', 250000)),
                step=10000.0,
                format="%.0f"
            )

            safety_threshold = st.number_input(
                "Safety Threshold ($)",
                value=float(settings.get('safety_threshold', 50000)),
                step=5000.0,
                format="%.0f"
            )

            payroll_threshold = st.number_input(
                "Payroll Risk Threshold ($)",
                value=float(settings.get('payroll_threshold', 30000)),
                step=5000.0,
                format="%.0f"
            )
        else:
            # Regular users see but can't edit
            opening_cash = float(settings.get('opening_cash', 250000))
            safety_threshold = float(settings.get('safety_threshold', 50000))
            payroll_threshold = float(settings.get('payroll_threshold', 30000))

            st.subheader("💼 Company Settings")
            st.metric("Opening Cash", f"${opening_cash:,.0f}")
            st.metric("Safety Threshold", f"${safety_threshold:,.0f}")

        st.divider()

        # Scenario Planning
        st.subheader("📊 Scenario Planning")
        st.caption("Adjust sliders to model different scenarios")

        revenue_confidence = st.slider(
            "Revenue Confidence (%)",
            min_value=70,
            max_value=110,
            value=100,
            help="Multiply inflows by this %"
        )

        expense_buffer = st.slider(
            "Expense Buffer (%)",
            min_value=90,
            max_value=150,
            value=100,
            help="Multiply outflows by this %"
        )

        st.divider()

        # AI Settings
        st.subheader("🤖 AI Settings")
        gemini_api_key = st.text_input(
            "Gemini API Key",
            type="password",
            help="Get free key at https://makersuite.google.com/app/apikey"
        )

        if gemini_api_key:
            st.success("AI Enabled ✓")
        else:
            st.warning("AI Disabled (No API Key)")

    # Main content
    st.title("💰 CFO Cash Command Center")
    st.caption("AI-Enabled 13-Week Rolling Cash Forecast")

    # Load data
    company_id = st.session_state.get('company_id', 'demo')
    transactions_df = load_transactions(company_id)

    # Calculate forecast
    forecast_df = calculate_13_week_forecast(
        transactions_df,
        opening_cash,
        revenue_confidence,
        expense_buffer
    )

    # Calculate KPIs
    kpis = calculate_kpis(
        forecast_df,
        safety_threshold,
        payroll_threshold,
        transactions_df
    )

    # Detect anomalies
    anomalies_df = detect_anomalies(transactions_df)

    # Build financial context (for AI)
    financial_context = build_financial_context(forecast_df, kpis, anomalies_df)

    # ==========================================
    # KPI TILES (Top Row)
    # ==========================================
    st.subheader("📊 Executive KPIs")

    col1, col2, col3, col4, col5 = st.columns(5)

    with col1:
        st.metric(
            "Lowest Cash Point",
            f"${kpis['lowest_cash_value']:,.0f}",
            delta=f"Week {kpis['lowest_cash_week']}",
            delta_color="inverse"
        )

    with col2:
        runway_color = "🟢" if kpis['weeks_of_runway'] > 10 else "🟡" if kpis['weeks_of_runway'] > 5 else "🔴"
        st.metric(
            "Weeks of Runway",
            f"{runway_color} {kpis['weeks_of_runway']:.1f}",
            delta=f"${kpis['average_burn_rate']:,.0f}/wk burn"
        )

    with col3:
        breach_color = "🟢" if kpis['weeks_below_threshold'] == 0 else "🟡" if kpis['weeks_below_threshold'] < 3 else "🔴"
        st.metric(
            "Weeks Below Threshold",
            f"{breach_color} {kpis['weeks_below_threshold']}",
            delta="weeks at risk"
        )

    with col4:
        payroll_color = "🟢" if kpis['payroll_risk_weeks'] == 0 else "🔴"
        st.metric(
            "Payroll Risk Weeks",
            f"{payroll_color} {kpis['payroll_risk_weeks']}",
            delta="high-risk periods"
        )

    with col5:
        volatility_colors = {'Low': '🟢', 'Medium': '🟡', 'High': '🔴'}
        vol_color = volatility_colors.get(kpis['volatility_rating'], '🟡')
        st.metric(
            "Cash Flow Volatility",
            f"{vol_color} {kpis['volatility_rating']}",
            delta=f"σ=${kpis['volatility_score']:,.0f}"
        )

    st.divider()

    # ==========================================
    # CHARTS
    # ==========================================
    chart_tab1, chart_tab2, chart_tab3 = st.tabs([
        "📈 Cash Balance Forecast",
        "📊 Inflows vs Outflows",
        "⚠️ Anomalies"
    ])

    with chart_tab1:
        # Main cash balance chart
        fig_balance = go.Figure()

        # Cash balance line
        fig_balance.add_trace(go.Scatter(
            x=forecast_df['Week'],
            y=forecast_df['Balance'],
            mode='lines+markers',
            name='Cash Balance',
            line=dict(color='#00C853', width=3),
            fill='tozeroy',
            fillcolor='rgba(0, 200, 83, 0.1)',
            hovertemplate='Week %{x}<br>Balance: $%{y:,.0f}<extra></extra>'
        ))

        # Safety threshold line
        fig_balance.add_hline(
            y=safety_threshold,
            line_dash="dash",
            line_color="red",
            annotation_text="Safety Threshold",
            annotation_position="right"
        )

        # Highlight lowest point
        lowest_week = kpis['lowest_cash_week']
        lowest_value = kpis['lowest_cash_value']
        fig_balance.add_trace(go.Scatter(
            x=[lowest_week],
            y=[lowest_value],
            mode='markers',
            name='Lowest Point',
            marker=dict(color='red', size=15, symbol='x'),
            hovertemplate=f'LOWEST: Week {lowest_week}<br>${lowest_value:,.0f}<extra></extra>'
        ))

        fig_balance.update_layout(
            title="13-Week Cash Balance Forecast",
            xaxis_title="Week",
            yaxis_title="Cash Balance ($)",
            hovermode="x unified",
            height=450,
            showlegend=True
        )

        st.plotly_chart(fig_balance, use_container_width=True)

        # Summary below chart
        if lowest_value < safety_threshold:
            st.error(f"⚠️ **ALERT**: Cash drops below safety threshold in Week {lowest_week} (${lowest_value:,.0f})")
        else:
            st.success("✅ Cash remains above safety threshold throughout the 13-week period")

    with chart_tab2:
        # Inflows vs Outflows bar chart
        fig_flows = go.Figure()

        fig_flows.add_trace(go.Bar(
            x=forecast_df['Week'],
            y=forecast_df['Inflow'],
            name='Inflows',
            marker_color='#4CAF50',
            hovertemplate='Week %{x}<br>Inflows: $%{y:,.0f}<extra></extra>'
        ))

        fig_flows.add_trace(go.Bar(
            x=forecast_df['Week'],
            y=forecast_df['Outflow'],
            name='Outflows',
            marker_color='#F44336',
            hovertemplate='Week %{x}<br>Outflows: $%{y:,.0f}<extra></extra>'
        ))

        fig_flows.update_layout(
            title="Weekly Inflows vs Outflows",
            xaxis_title="Week",
            yaxis_title="Amount ($)",
            barmode='group',
            hovermode="x unified",
            height=450
        )

        st.plotly_chart(fig_flows, use_container_width=True)

        # Net flow summary
        st.subheader("Net Cash Flow by Week")
        net_flow_df = forecast_df[['Week', 'Net']].copy()
        net_flow_df['Status'] = net_flow_df['Net'].apply(
            lambda x: '✅ Positive' if x > 0 else '⚠️ Negative'
        )
        st.dataframe(
            net_flow_df.style.format({'Net': '${:,.0f}'}),
            use_container_width=True,
            hide_index=True
        )

    with chart_tab3:
        st.subheader("🔍 Anomaly Detection")
        st.caption("Line items >±20% from historical average")

        if len(anomalies_df) > 0:
            # Display anomalies
            anomalies_display = anomalies_df.copy()
            anomalies_display['transaction_date'] = pd.to_datetime(anomalies_display['transaction_date']).dt.strftime('%Y-%m-%d')

            st.dataframe(
                anomalies_display.style.format({
                    'amount': '${:,.0f}',
                    'avg_amount': '${:,.0f}',
                    'pct_deviation': '{:+.1f}%'
                }),
                use_container_width=True,
                hide_index=True
            )

            # Anomaly chart
            fig_anom = px.bar(
                anomalies_df.head(10),
                x='category',
                y='pct_deviation',
                color='pct_deviation',
                color_continuous_scale=['red', 'yellow', 'green'],
                title="Top 10 Anomalies by % Deviation",
                labels={'pct_deviation': 'Deviation from Average (%)'}
            )
            st.plotly_chart(fig_anom, use_container_width=True)
        else:
            st.success("✅ No significant anomalies detected")

    st.divider()

    # ==========================================
    # AI INSIGHTS & CHAT
    # ==========================================
    ai_col1, ai_col2 = st.columns([1, 1])

    with ai_col1:
        st.subheader("🤖 AI CFO Insights")

        if st.button("Generate CFO Report", type="primary", use_container_width=True):
            if gemini_api_key:
                with st.spinner("Analyzing financials..."):
                    insight = get_ai_insight(financial_context, gemini_api_key)
                    st.markdown(insight)

                    # Save to session for reference
                    st.session_state.last_insight = insight
            else:
                st.warning("⚠️ Please enter Gemini API Key in Settings to enable AI features")

        # Show last insight if available
        if 'last_insight' in st.session_state:
            with st.expander("📄 Last Generated Report"):
                st.markdown(st.session_state.last_insight)

    with ai_col2:
        st.subheader("💬 Ask the CFO")
        st.caption("Ask questions about your cash forecast")

        # Initialize chat history
        if 'chat_history' not in st.session_state:
            st.session_state.chat_history = []

        # Chat input
        user_question = st.text_input(
            "Your question:",
            placeholder="e.g., What's the lowest cash point this quarter?",
            key="cfo_question"
        )

        if st.button("Ask", type="primary", use_container_width=True):
            if user_question:
                if gemini_api_key:
                    with st.spinner("Thinking..."):
                        answer = ask_the_cfo(user_question, financial_context, gemini_api_key)

                        # Add to chat history
                        st.session_state.chat_history.append({
                            'question': user_question,
                            'answer': answer,
                            'timestamp': datetime.now()
                        })
                else:
                    st.warning("Please enter Gemini API Key in Settings")
            else:
                st.warning("Please enter a question")

        # Display chat history
        if st.session_state.chat_history:
            st.divider()
            for i, chat in enumerate(reversed(st.session_state.chat_history[-5:])):
                with st.container():
                    st.markdown(f"**Q:** {chat['question']}")
                    st.markdown(f"**A:** {chat['answer']}")
                    st.caption(f"_{chat['timestamp'].strftime('%Y-%m-%d %H:%M')}_")
                    if i < len(st.session_state.chat_history) - 1:
                        st.divider()

    # ==========================================
    # DEBUG PANEL (for developers)
    # ==========================================
    with st.expander("🔧 Debug: Financial Context (AI Input)"):
        st.code(financial_context, language="text")
        st.caption("This is the exact data sent to the AI model to prevent hallucinations")

# ==========================================
# MAIN APP ENTRY POINT
# ==========================================
def main():
    """Main application entry point"""

    # Initialize session state
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False

    # Route to appropriate page
    if st.session_state.authenticated:
        show_dashboard()
    else:
        show_auth_page()

if __name__ == "__main__":
    main()
