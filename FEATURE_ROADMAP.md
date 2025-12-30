# 🚀 CFO Cash Command - Feature Roadmap

## ✅ Completed Features

- ✅ User authentication (Supabase Auth)
- ✅ 13-week cash forecast
- ✅ Interactive charts (Recharts)
- ✅ Scenario planning sliders
- ✅ 5 Smart KPIs
- ✅ Gemini AI integration (lib/ai.ts)
- ✅ "Ask the CFO" chat page (/chat)
- ✅ Responsive dashboard
- ✅ Vercel deployment

---

## 🎯 Priority 1: Core Data Management (Week 1)

### 1.1 Transaction Management (/transactions)
**Why**: CFOs need to input actual cash flows to compare against forecast

**Features**:
- ✅ Add transactions manually (date, category, amount, type)
- ✅ Edit/delete existing transactions
- ✅ Bulk upload via CSV
- ✅ Filter by date range, category, type
- ✅ Search transactions
- ✅ Export to CSV

**Pages to Create**:
- `/app/transactions/page.tsx` - List view with filters
- `/app/transactions/add/page.tsx` - Add new transaction form
- `/app/transactions/[id]/page.tsx` - Edit transaction

**Database**: Already exists in `transactions` table

---

### 1.2 Date Range Selector
**Why**: CFOs want to forecast from different start dates

**Implementation**:
```typescript
// Add to dashboard
const [startDate, setStartDate] = useState(new Date())
const [forecastWeeks, setForecastWeeks] = useState(13)

// Update forecast calculation
const forecast = calculate13WeekForecast(transactions, startDate, forecastWeeks)
```

**UI Component**:
```tsx
<div className="flex gap-4">
  <Input
    type="date"
    value={startDate.toISOString().split('T')[0]}
    onChange={(e) => setStartDate(new Date(e.target.value))}
  />
  <select value={forecastWeeks} onChange={(e) => setForecastWeeks(Number(e.target.value))}>
    <option value="8">8 weeks</option>
    <option value="13">13 weeks</option>
    <option value="26">26 weeks</option>
    <option value="52">52 weeks</option>
  </select>
</div>
```

---

### 1.3 Real AI Insights on Dashboard
**Status**: Code ready in `lib/ai.ts`

**To Implement**:
Update `/app/dashboard/page.tsx`:

```typescript
import { generateCFOInsights } from '@/lib/ai'

// In component:
const [aiInsights, setAIInsights] = useState('')
const [loadingAI, setLoadingAI] = useState(false)

const generateInsights = async () => {
  setLoadingAI(true)
  const context: ForecastContext = {
    forecast: forecastData,
    kpis: kpis,
  }
  const insights = await generateCFOInsights(context)
  setAIInsights(insights)
  setLoadingAI(false)
}

// Replace mock insights with:
<Button onClick={generateInsights} disabled={loadingAI}>
  {loadingAI ? 'Generating...' : 'Generate AI Insights'}
</Button>
{aiInsights && <div className="prose">{aiInsights}</div>}
```

---

## 🎯 Priority 2: Analysis & Insights (Week 2)

### 2.1 Actuals vs Forecast (/actuals-vs-forecast)
**Why**: Track forecast accuracy, learn from variances

**Features**:
- Side-by-side comparison (forecasted vs actual)
- Variance analysis (% and $)
- Chart showing both lines
- Weekly breakdown table
- Accuracy score

**Key Charts**:
```tsx
<LineChart>
  <Line dataKey="forecasted" stroke="#blue" name="Forecast" />
  <Line dataKey="actual" stroke="#green" name="Actual" />
  <Line dataKey="variance" stroke="#red" name="Variance" strokeDasharray="3 3" />
</LineChart>
```

---

### 2.2 Anomaly Detection (Enhanced)
**Why**: Automatically flag unusual transactions

**Implementation**:
```typescript
// In lib/anomalies.ts
export function detectAnomalies(transactions, threshold = 20) {
  const avgByCategory = groupBy(transactions, 'category')
    .map(group => ({
      category: group.key,
      avgAmount: mean(group.items.map(t => t.amount)),
      stdDev: standardDeviation(group.items.map(t => t.amount)),
    }))

  return transactions.filter(t => {
    const cat = avgByCategory.find(c => c.category === t.category)
    if (!cat) return false

    const zScore = (t.amount - cat.avgAmount) / cat.stdDev
    return Math.abs(zScore) > 2 // 2 standard deviations
  })
}
```

**UI**: Highlight anomalies in red on dashboard + dedicated anomalies page

---

### 2.3 Scenarios Management (/scenarios)
**Why**: Save and compare multiple what-if scenarios

**Features**:
- Save current scenario with name
- Load saved scenarios
- Compare 2-3 scenarios side-by-side
- Scenario templates (Best Case, Worst Case, Most Likely)

**Database Schema** (already exists):
```sql
scenarios (
  id, company_id, scenario_name,
  revenue_confidence, expense_buffer,
  forecast_data (jsonb), created_at
)
```

---

## 🎯 Priority 3: Team & Governance (Week 3)

### 3.1 Settings Page (/settings)
**Features**:
- Company profile (name, opening cash, thresholds)
- User management (invite users, assign roles)
- Category management (add custom categories)
- Alert settings (email when cash < threshold)
- Data retention policies

**Tabs**:
- Company Settings
- Users & Teams
- Categories
- Alerts & Notifications
- Integration Settings (future: accounting software)

---

### 3.2 User Roles & Permissions
**Implementation**:

```typescript
// Extend RBAC in Supabase
enum Roles {
  ADMIN = 'ADMIN',      // Full access
  FINANCE = 'FINANCE',  // View + add transactions
  VIEWER = 'VIEWER',    // Read-only
}

// In components:
const { user, role } = useAuth()

{role === 'ADMIN' && (
  <Button onClick={deleteTransaction}>Delete</Button>
)}
```

---

### 3.3 Audit Trail
**Why**: Track who changed what and when

**Database Schema**:
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  table_name TEXT,
  record_id UUID,
  action TEXT, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI**: `/audit` page showing recent changes

---

## 🎯 Priority 4: Reporting & Export (Week 4)

### 4.1 PDF Export
**Package**: `@react-pdf/renderer`

```bash
npm install @react-pdf/renderer
```

**Implementation**:
```typescript
import { Document, Page, Text, View, PDFDownloadLink } from '@react-pdf/renderer'

const ForecastPDF = ({ forecast, kpis }) => (
  <Document>
    <Page>
      <View><Text>13-Week Cash Forecast</Text></View>
      <View><Text>Lowest Cash: ${kpis.lowestCash}</Text></View>
      {/* ... */}
    </Page>
  </Document>
)

// In UI:
<PDFDownloadLink document={<ForecastPDF />} fileName="forecast.pdf">
  {({ loading }) => loading ? 'Generating...' : 'Download PDF'}
</PDFDownloadLink>
```

---

### 4.2 Analytics Page (/analytics)
**Features**:
- Cash flow trends (6 months history)
- Category breakdown (pie chart)
- Month-over-month comparison
- Seasonal patterns
- Burn rate trend

**Charts**:
- Line chart: Cash balance over time
- Pie chart: Outflows by category
- Bar chart: Inflows vs Outflows by month
- Heatmap: Cash by week/day

---

## 🎯 Priority 5: Advanced Features (Month 2)

### 5.1 Cash Flow Statement (Proper Accounting Format)
**Format**:
```
Operating Activities:
  Cash received from customers       $xxx
  Cash paid to suppliers            ($xxx)
  Cash paid for salaries            ($xxx)
  Net cash from operations          $xxx

Investing Activities:
  Purchase of equipment             ($xxx)
  Net cash from investing           ($xxx)

Financing Activities:
  Loan proceeds                     $xxx
  Loan repayments                   ($xxx)
  Net cash from financing           $xxx

Net increase in cash                $xxx
```

---

### 5.2 Multi-Currency Support
**Implementation**:
- Add `currency` field to transactions
- Exchange rate API (e.g., exchangerate-api.io)
- Convert all to base currency for reporting
- Show original currency in detail views

---

### 5.3 Integration with Accounting Software
**Options**:
- QuickBooks API
- Xero API
- Stripe API (for online payments)

**Flow**:
1. Connect account (OAuth)
2. Sync transactions automatically
3. Map categories to forecast categories
4. Auto-update forecasts

---

### 5.4 Alerts & Notifications
**Triggers**:
- Cash drops below safety threshold
- Payroll week with low cash
- Large variance between forecast and actual
- Anomaly detected

**Channels**:
- Email (SendGrid/Resend)
- In-app notifications
- Slack webhook (optional)

---

## 🏗️ Technical Implementation Notes

### Navigation Structure
Add to dashboard header:

```tsx
<nav className="flex gap-4">
  <Link href="/dashboard">Dashboard</Link>
  <Link href="/transactions">Transactions</Link>
  <Link href="/actuals-vs-forecast">Actuals vs Forecast</Link>
  <Link href="/scenarios">Scenarios</Link>
  <Link href="/analytics">Analytics</Link>
  <Link href="/chat">Ask CFO</Link>
  {role === 'ADMIN' && <Link href="/settings">Settings</Link>}
</nav>
```

### API Routes (if needed)
```
/api/forecast/calculate  - POST - Calculate forecast
/api/forecast/compare    - POST - Compare scenarios
/api/ai/insights         - POST - Generate AI insights
/api/ai/chat             - POST - Chat with AI
/api/export/pdf          - GET  - Export PDF
/api/export/csv          - GET  - Export CSV
```

### State Management (Optional)
For complex state, consider:
- Zustand (lightweight)
- React Query (for server state)
- Context API (for auth/user)

---

## 📊 CFO Dashboard Enhancements

### Additional KPIs to Add:
1. **Quick Ratio** - (Cash + Receivables) / Current Liabilities
2. **Days Cash on Hand** - Cash / Daily Burn Rate
3. **Cash Conversion Cycle** - Days to convert inventory/services to cash
4. **Working Capital** - Current Assets - Current Liabilities
5. **Burn Multiple** - Net Burn / Net New ARR (for SaaS)

### Additional Charts:
1. **Waterfall Chart** - Show cash flow changes week-by-week
2. **Heatmap** - Cash levels by week/month
3. **Funnel Chart** - Cash sources breakdown
4. **Gauge Chart** - Current cash as % of target

---

## 🎯 Success Metrics

Track these to measure dashboard value:

1. **Usage Metrics**:
   - Daily active users
   - Forecast views per week
   - Chat questions asked
   - PDF exports generated

2. **Business Metrics**:
   - Forecast accuracy (actual vs predicted)
   - Time saved vs manual forecasting
   - Number of cash crises avoided
   - Stakeholder satisfaction score

3. **Data Quality**:
   - % transactions auto-imported vs manual
   - Anomalies detected and resolved
   - Forecast update frequency

---

## 🚀 Next Steps

1. **This Week**: Complete Transactions page + Date selector
2. **Next Week**: Actuals vs Forecast + Enhanced AI
3. **Month 1**: Settings + User management
4. **Month 2**: Advanced analytics + Integrations

---

## 📚 Resources

- **Gemini API Docs**: https://ai.google.dev/docs
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **Recharts Examples**: https://recharts.org/en-US/examples
- **React PDF**: https://react-pdf.org/
- **Date Picker**: Use `react-datepicker` or Radix UI

---

**Built for CFOs, by engineers who understand finance.**
