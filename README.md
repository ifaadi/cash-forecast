# 💰 AI-Enabled CFO Cash Forecasting Command Center

> **Free/OSS-First Cloud Cash Forecasting System**
>
> A modern, AI-powered 13-week rolling cash forecast dashboard for CFOs and finance teams.
> Built with free-tier tools: Streamlit, Supabase, and Google Gemini.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Streamlit](https://img.shields.io/badge/streamlit-1.28+-red.svg)

---

## 🚀 Features

### Core Forecasting
- ✅ **13-Week Rolling Cash Forecast** (Direct Method)
  - Weekly inflows vs outflows
  - Running cash balance calculations
  - Automatic net flow computation

- ✅ **Scenario Planning**
  - Revenue confidence slider (70%-110%)
  - Expense buffer slider (90%-150%)
  - Live chart updates

### Smart KPIs (Auto-Computed)
- 💎 **Lowest Cash Point** - Week and dollar value
- 📊 **Weeks of Runway** - Based on average burn rate
- ⚠️ **Weeks Below Threshold** - Safety breach warnings
- 💸 **Payroll Risk Weeks** - Critical cash periods flagged
- 📈 **Volatility Score** - Cash flow stability rating
- 🔥 **Average Burn Rate** - Weekly cash consumption

### AI Features (Grounded in Real Data)
- 🤖 **AI CFO Insights** - Automated executive summary
  - Liquidity status analysis
  - Risk identification (timing + cause)
  - Actionable recommendations

- 💬 **"Ask the CFO" Chat** - Q&A about your forecast
  - Answers grounded in computed data
  - Anti-hallucination guardrails
  - Context-aware responses

- 🔍 **Anomaly Detection**
  - Flags line items >±20% from average
  - Visual anomaly charts
  - Included in AI context

### Authentication & Security
- 🔐 **Supabase Auth** - Email/password authentication
- 👥 **RBAC (Role-Based Access Control)**
  - **ADMIN** - Full settings access
  - **USER** - Dashboard and forecast access
  - First user automatically becomes ADMIN

### Modern Dashboard
- 📊 **Interactive Plotly Charts**
  - Cash balance forecast curve
  - Inflow vs Outflow bars
  - Anomaly visualizations

- 🎨 **Executive-Ready Layout**
  - KPI tiles with color-coded status
  - Tabbed chart interface
  - Responsive design

---

## 🛠️ Tech Stack (100% Free Tier Compatible)

| Component | Technology | Cost |
|-----------|-----------|------|
| **Frontend** | Streamlit | Free |
| **Hosting** | Streamlit Community Cloud | Free |
| **Database** | Supabase (Postgres) | Free tier |
| **Auth** | Supabase Auth | Free tier |
| **AI/LLM** | Google Gemini | Free tier |
| **Charts** | Plotly | Free (OSS) |

**Total Monthly Cost: $0** 🎉

---

## 📦 Quick Start

### Option A: Deploy to Streamlit Cloud (Recommended)

1. **Fork this repository** to your GitHub account

2. **Set up Supabase** (5 minutes)
   ```bash
   # Go to: https://supabase.com
   # 1. Create new project (free tier)
   # 2. Go to SQL Editor
   # 3. Copy-paste contents of supabase_schema.sql
   # 4. Run the script
   # 5. Go to Settings > API and copy your credentials
   ```

3. **Deploy to Streamlit Cloud**
   ```bash
   # Go to: https://share.streamlit.io
   # 1. Click "New app"
   # 2. Connect your forked repository
   # 3. Set main file: app.py
   # 4. Click "Advanced settings" > "Secrets"
   # 5. Paste your Supabase credentials:

   SUPABASE_URL = "https://your-project.supabase.co"
   SUPABASE_KEY = "your-anon-key"

   # 6. Click "Deploy"
   ```

4. **Register first user** (becomes ADMIN automatically)

5. **(Optional) Get Gemini API Key** for AI features
   ```bash
   # Go to: https://makersuite.google.com/app/apikey
   # Create free API key
   # Enter in app sidebar under "AI Settings"
   ```

### Option B: Local Development

1. **Clone repository**
   ```bash
   git clone <your-repo-url>
   cd cash-forecast
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure secrets**
   ```bash
   # Copy template
   cp .streamlit/secrets.toml.example .streamlit/secrets.toml

   # Edit .streamlit/secrets.toml with your credentials
   ```

4. **Set up Supabase database**
   ```bash
   # Run supabase_schema.sql in your Supabase SQL Editor
   ```

5. **Run app**
   ```bash
   streamlit run app.py
   ```

6. **Open browser** at `http://localhost:8501`

### Option C: Demo Mode (No Setup Required)

1. Run the app without Supabase credentials
2. Click **"Try Demo Mode"** on login page
3. Explore with sample data (no auth, no persistence)

---

## 🗄️ Database Schema

The system uses Supabase (PostgreSQL) with the following tables:

- **`user_profiles`** - Extended user metadata + roles
- **`companies`** - Company settings (thresholds, opening cash)
- **`transactions`** - Cash inflows/outflows (13-week history)
- **`scenarios`** - Saved forecast scenarios
- **`forecasts`** - Cached forecast results + KPIs
- **`chat_history`** - "Ask the CFO" conversation logs

**Row-Level Security (RLS)** enabled on all tables for multi-tenant isolation.

See `supabase_schema.sql` for full schema with triggers and policies.

---

## 🧮 How It Works

### Data → Prompt Grounding Pipeline

This system implements a **strict anti-hallucination pipeline**:

```python
# STEP 1: Compute (Math First)
forecast_df = calculate_13_week_forecast(transactions, opening_cash)
kpis = calculate_kpis(forecast_df)
anomalies = detect_anomalies(transactions)

# STEP 2: Condense (Context Builder)
financial_context = build_financial_context(forecast_df, kpis, anomalies)
# Returns compact text summary of computed results

# STEP 3: Prompt Injection
prompt = f"""
Use ONLY the data below. Do NOT fabricate.

{financial_context}

Provide CFO insights...
"""

# STEP 4: AI Response
insight = gemini.generate(prompt)
```

**Why this matters:**
- AI only sees **computed numbers** (not raw data)
- Prevents fabrication of facts
- Ensures consistency between charts and AI narrative

---

## 📊 Key Functions (Required by Spec)

### `build_financial_context(forecast_df, kpi_dict, anomalies_df) -> str`
Converts computed forecast + KPIs into compact text summary for LLM grounding.

**Returns:**
```
=== CASH FORECAST SUMMARY (13 WEEKS) ===

WEEKLY CASH POSITION:
Week 1: Net $7,000 | Ending Cash $257,000
Week 2: Net -$31,000 | Ending Cash $226,000
...
Week 7: Ending Cash $39,500 ⚠️ LOWEST CASH POINT

=== KEY PERFORMANCE INDICATORS ===
Lowest Cash Point: Week 7 at $39,500
Weeks of Runway: 7.2 weeks
Weeks Below Threshold: 3 weeks
Payroll Risk Weeks: 2 weeks
Cash Flow Volatility: High (σ=$28,432)
Average Burn Rate: $35,000/week

=== DETECTED ANOMALIES (>±20% from average) ===
Vendor Payments: $12,500 (+32.1% vs avg $9,500)
Freight: $3,800 (+27.3% vs avg $2,987)
...
```

### `get_ai_insight(financial_context: str, api_key: str) -> str`
Sends grounded context to Gemini and returns CFO-style narrative.

**CFO-Style Prompt Template:**
```python
"""
You are a seasoned CFO analyzing a 13-week cash forecast.

CRITICAL RULES:
1. Use ONLY the data provided below
2. If data is missing, explicitly state what's missing
3. Do NOT fabricate numbers, dates, or facts
4. Focus on actionable operational advice

FINANCIAL DATA:
{financial_context}

Provide a concise CFO Executive Summary with:
- Liquidity Status (2-3 bullets)
- Key Risks (2-3 bullets)
- Recommended Actions (1-2 bullets)
"""
```

---

## 🎯 User Roles

### ADMIN
- ✅ Modify company settings (opening cash, thresholds)
- ✅ View/edit all transactions
- ✅ Manage scenarios
- ✅ Full dashboard access
- ✅ User management (via Supabase dashboard)

### USER
- ✅ View dashboard and forecasts
- ✅ Run scenario planning
- ✅ Use AI chat
- ✅ Create/save scenarios
- ❌ Cannot modify company settings

**First user to register automatically becomes ADMIN.**

---

## 🔒 Security Best Practices

1. **Never commit secrets**
   - `.streamlit/secrets.toml` is in `.gitignore`
   - Use environment variables or Streamlit Cloud secrets

2. **Row-Level Security (RLS)**
   - All Supabase tables have RLS policies
   - Users can only access their company's data

3. **API Key Storage**
   - Gemini API key stored in session state (not database)
   - Users can provide their own keys

4. **Auth Flow**
   - Supabase Auth handles all authentication
   - Session tokens expire automatically
   - No plain-text password storage

---

## 📈 Roadmap

### Planned Features
- [ ] CSV/Excel transaction upload
- [ ] Multi-currency support
- [ ] Custom KPI definitions (ADMIN)
- [ ] Email alerts for threshold breaches
- [ ] PDF report export
- [ ] Integration with accounting software (QuickBooks, Xero)
- [ ] Mobile-responsive optimizations
- [ ] Dark mode toggle

### AI Enhancements
- [ ] Predictive forecasting (ML models)
- [ ] Automated scenario generation
- [ ] Natural language query builder
- [ ] Multi-language support

---

## 🐛 Troubleshooting

### "Database not configured" error
**Solution:** Check `.streamlit/secrets.toml` has valid `SUPABASE_URL` and `SUPABASE_KEY`

### AI features not working
**Solution:**
1. Verify Gemini API key is entered in sidebar
2. Check API quota at https://makersuite.google.com
3. Try regenerating API key if expired

### First user not becoming ADMIN
**Solution:**
1. Check Supabase SQL Editor > Run:
   ```sql
   SELECT * FROM user_profiles;
   ```
2. Manually update role:
   ```sql
   UPDATE user_profiles SET role = 'ADMIN' WHERE email = 'your@email.com';
   ```

### Charts not displaying
**Solution:**
1. Clear browser cache
2. Check browser console for errors
3. Verify Plotly is installed: `pip show plotly`

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

Built with:
- [Streamlit](https://streamlit.io) - Beautiful data apps
- [Supabase](https://supabase.com) - Open-source Firebase alternative
- [Google Gemini](https://ai.google.dev) - Free AI API
- [Plotly](https://plotly.com) - Interactive charts

---

## 📧 Support

- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation:** See this README

---

## ⚡ Performance Notes

### Free Tier Limits

| Service | Free Tier Limit | Notes |
|---------|----------------|-------|
| Streamlit Cloud | 1 GB RAM | Sufficient for 1000s of transactions |
| Supabase | 500 MB DB | ~100K+ transaction records |
| Gemini API | 60 requests/min | Ample for typical usage |

### Optimization Tips

1. **Cache Supabase client** - `@st.cache_resource` decorator used
2. **Limit query results** - Use date ranges for large datasets
3. **Async loading** - Charts render while AI processes
4. **Session state** - Minimize re-computations

---

## 🎓 Learning Resources

### Understanding Cash Forecasting
- [Direct Method vs Indirect Method](https://www.investopedia.com/terms/d/direct_method.asp)
- [13-Week Cash Flow Forecasting](https://www.cfoinstitute.org/cash-flow-forecasting)

### Tech Stack Tutorials
- [Streamlit Docs](https://docs.streamlit.io)
- [Supabase Quickstart](https://supabase.com/docs/guides/getting-started)
- [Gemini API Guide](https://ai.google.dev/docs)

---

**Built with ❤️ for CFOs who code (or want to)**

*Making treasury management accessible, intelligent, and free.*
