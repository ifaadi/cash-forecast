import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, timedelta
import google.generativeai as genai
from supabase import create_client, Client
import json

# ==========================================
# 1. PAGE SETUP
# ==========================================
st.set_page_config(page_title="CEO Cash Command", layout="wide", page_icon="🏦")

# ==========================================
# 2. CONNECT TO SUPABASE (THE DATABASE)
# ==========================================
# We use 'st.secrets' to keep passwords safe. 
# This looks for your keys in the Streamlit Cloud settings.
try:
    supabase_url = st.secrets["SUPABASE_URL"]
    supabase_key = st.secrets["SUPABASE_KEY"]
    supabase: Client = create_client(supabase_url, supabase_key)
    db_connected = True
except Exception as e:
    db_connected = False
    # If we are just testing and don't have the DB set up yet, we don't crash.
    # We just warn the user.

# ==========================================
# 3. SIDEBAR CONTROLS
# ==========================================
with st.sidebar:
    st.header("⚙️ Control Panel")
    
    # A. AI Security
    # We ask for the API key here so it's not hard-coded in the script
    api_key = st.text_input("Gemini API Key", type="password")
    
    st.divider()
    
    # B. Scenario Loader (The "Memory" Feature)
    st.subheader("💾 Scenarios")
    if db_connected:
        try:
            # Fetch saved forecasts from Supabase
            response = supabase.table('forecasts').select("id, scenario_name, created_at").order('created_at', desc=True).execute()
            
            # Create a dictionary to map names to data
            scenarios = {f"{item['scenario_name']} ({item['created_at'][:10]})": item['forecast_data'] for item in response.data}
            
            # Dropdown menu
            selected_scenario = st.selectbox("Load Saved Scenario", ["Current Working Model"] + list(scenarios.keys()))
            
            if selected_scenario != "Current Working Model":
                st.info(f"Loaded: {selected_scenario}")
        except:
            st.error("Could not fetch scenarios. Check Database Table.")
    else:
        st.warning("Database not connected.")
    
    st.divider()
    
    # C. Financial Variables (The "CFO" Inputs)
    st.subheader("Inputs")
    opening_cash = st.number_input("Opening Cash ($)", value=250000, step=10000)
    min_thresh = st.number_input("Min Threshold ($)", value=50000, step=5000)
    
    st.subheader("Stress Test")
    rev_conf = st.slider("Revenue Confidence (%)", 50, 120, 100)
    opex_buff = st.slider("Opex Buffer (%)", 90, 150, 100)

# ==========================================
# 4. DATA ENGINE (THE MATH)
# ==========================================
def get_default_data():
    """Generates a dummy 13-week forecast if no data is loaded."""
    dates = [date.today() + timedelta(weeks=i) for i in range(13)]
    data = []
    for i, d in enumerate(dates):
        d_str = d.strftime("%Y-%m-%d")
        # Standard Inflows
        data.append({"Date": d_str, "Category": "Sales", "Type": "Inflow", "Amount": 40000})
        # Standard Outflows
        data.append({"Date": d_str, "Category": "Ops", "Type": "Outflow", "Amount": 8000})
        # Payroll every 2 weeks
        if i % 2 == 0: 
            data.append({"Date": d_str, "Category": "Payroll", "Type": "Outflow", "Amount": 35000})
    return pd.DataFrame(data)

# Step A: Load Base Data
df_raw = get_default_data()

# Step B: If user selected a saved scenario, replace base data
if db_connected and 'scenarios' in locals() and selected_scenario != "Current Working Model":
    # We load the JSON data back into a Pandas DataFrame
    saved_json = scenarios[selected_scenario]
    df_raw = pd.DataFrame(saved_json)

# Step C: Apply Stress Test Sliders
df_mod = df_raw.copy()
df_mod['Date'] = pd.to_datetime(df_mod['Date'])

# Adjust Inflows/Outflows based on slider percentage
df_mod.loc[df_mod['Type'] == 'Inflow', 'Amount'] *= (rev_conf / 100)
df_mod.loc[df_mod['Type'] == 'Outflow', 'Amount'] *= (opex_buff / 100)

# Step D: Aggregation (Pivot Table)
df_weekly = df_mod.groupby([pd.Grouper(key='Date', freq='W-MON'), 'Type'])['Amount'].sum().reset_index()
df_pivot = df_weekly.pivot(index='Date', columns='Type', values='Amount').fillna(0)

# Ensure columns exist even if data is zero
for c in ['Inflow','Outflow']: 
    if c not in df_pivot.columns: df_pivot[c] = 0

# Calculate Net Flow & Running Balance
df_pivot['Net'] = df_pivot['Inflow'] - df_pivot['Outflow']

balance = opening_cash
balances = []
for net in df_pivot['Net']:
    balance += net
    balances.append(balance)
df_pivot['Balance'] = balances

# ==========================================
# 5. AI ENGINE (THE INTELLIGENCE)
# ==========================================
def get_ai_insight():
    if not api_key: return "⚠️ Please provide Gemini API Key in the sidebar."
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')
        
        # We summarize the data so we don't send too much to the AI
        summary_csv = df_pivot.to_csv()
        
        prompt = f"""
        Act as an expert CFO for a retail company. 
        Analyze this 13-week cash forecast: 
        {summary_csv}
        
        Context:
        - Opening Cash: ${opening_cash}
        - Minimum Safety Threshold: ${min_thresh}
        
        Provide a "CFO Executive Summary":
        1. **Liquidity Status**: Are we safe? When is the low point?
        2. **Burn Rate Warning**: Are any weeks dangerously negative?
        3. **Actionable Advice**: Give one specific move to improve cash flow.
        """
        
        return model.generate_content(prompt).text
    except Exception as e:
        return f"AI Error: {e}"

# ==========================================
# 6. DASHBOARD UI (THE LOOKS)
# ==========================================
st.title("🏦 Enterprise Cash Command Center")

# SAVE SCENARIO SECTION
if db_connected:
    with st.expander("💾 Save Current Scenario"):
        col_a, col_b = st.columns([3, 1])
        with col_a:
            save_name = st.text_input("Name this Scenario", placeholder="e.g. Q1 Recession Case")
        with col_b:
            st.write("") # Spacer
            st.write("") # Spacer
            if st.button("Save to Cloud"):
                # Save the raw data (df_raw) so we can re-calculate later
                json_data = df_raw.to_dict(orient='records')
                supabase.table('forecasts').insert({
                    "scenario_name": save_name, 
                    "forecast_data": json_data
                }).execute()
                st.success("Saved!")
                st.rerun() # Refresh page to show new scenario in sidebar

# KEY METRICS
col1, col2, col3 = st.columns(3)
low_point = min(balances)
burn_weeks = len(df_pivot[df_pivot['Net'] < 0])

col1.metric("13-Week Low", f"${low_point:,.0f}", delta=f"{low_point-opening_cash:,.0f}")
col2.metric("Safety Threshold", f"${min_thresh:,.0f}")
col3.metric("Weeks Burning Cash", f"{burn_weeks} Weeks", delta_color="inverse")

# CHARTS
tab1, tab2 = st.tabs(["Liquidity Forecast", "AI CFO Report"])

with tab1:
    fig = go.Figure()
    # Cash Balance Line
    fig.add_trace(go.Scatter(
        x=df_pivot.index, y=df_pivot['Balance'], 
        fill='tozeroy', name='Cash Position', line=dict(color='#00C853', width=3)
    ))
    # Threshold Line
    fig.add_hline(y=min_thresh, line_dash="dash", line_color="red", annotation_text="Danger Zone")
    
    fig.update_layout(height=450, hovermode="x unified")
    st.plotly_chart(fig, use_container_width=True)

with tab2:
    st.write("Click below to have Google Gemini analyze your liquidity position.")
    if st.button("Generate CFO Report"):
        with st.spinner("Analyzing financials..."):
            insight = get_ai_insight()
            st.markdown(insight)
