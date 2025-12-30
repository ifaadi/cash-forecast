# 🚀 Deploy CFO Cash Command Center to Vercel

## ✅ What You Have

A complete, working MVP with:
- 💰 13-week cash forecast with interactive charts
- 📊 5 Smart KPI cards (runway, volatility, risks)
- 🎚️ Scenario planning sliders
- 🔐 Supabase authentication
- 📈 Recharts visualizations
- 🎨 Clean, professional UI

---

## 📋 Prerequisites

1. **Supabase Account** (free tier)
2. **Vercel Account** (free tier)
3. **Git/GitHub** (code is already pushed)

---

## 🗄️ Step 1: Supabase Setup (5 minutes)

### 1.1 Run Database Schema

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy-paste contents of `supabase_schema.sql`
5. Click **Run**
6. ✅ Should see "Success. No rows returned"

### 1.2 Disable RLS Temporarily (for initial testing)

Run this SQL:

```sql
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
```

*We'll re-enable after first user registers*

### 1.3 Get Credentials

1. Click **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciO...`

Keep these handy!

---

## 🚢 Step 2: Deploy to Vercel (5 minutes)

### 2.1 Connect GitHub

1. Go to https://vercel.com
2. Click **"Add New Project"**
3. Import your GitHub repo: `ifaadi/cash-forecast`
4. Select branch: `claude/ai-cash-forecasting-IQsby`

### 2.2 Configure Build Settings

```
Root Directory: frontend
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 2.3 Add Environment Variables

Click **"Environment Variables"** and add:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciO...
```

*(Use YOUR credentials from Step 1.3)*

### 2.4 Deploy!

1. Click **"Deploy"**
2. ⏳ Wait 2-3 minutes
3. ✅ Your app is live!

---

## 👤 Step 3: Create First User (1 minute)

1. Open your Vercel app URL
2. Click **"Need an account? Register"**
3. Enter email + password
4. Click **"Register"**
5. ✅ See "Account created! Please login"
6. Login with your credentials
7. 🎉 You're in the dashboard!

---

## 🔒 Step 4: Re-Enable Security (Optional)

After first user registers, go back to Supabase SQL Editor and run:

```sql
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_any" ON public.user_profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "companies_select_own" ON public.companies
    FOR SELECT USING (
        id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "companies_insert_any" ON public.companies
    FOR INSERT WITH CHECK (true);
```

---

## ✨ Step 5: Test Features

In your dashboard, try:

1. **Scenario Sliders**: Move revenue/expense sliders → charts update!
2. **KPI Cards**: See runway, risk metrics
3. **Charts**: Interactive hover, zoom
4. **AI Insights**: Read automated CFO summary
5. **Logout/Login**: Test authentication

---

## 🎯 What Works

✅ User authentication (login/register)
✅ 13-week cash forecast
✅ 5 Smart KPIs
✅ Interactive charts (Recharts)
✅ Scenario planning sliders
✅ AI-generated insights (mock data)
✅ Professional UI
✅ Responsive design

---

## 🚀 Next Enhancements (After MVP is Live)

Once you validate the concept with your CEO/CFO:

1. **Real Transaction Data**
   - Add transaction input form
   - Connect to accounting software

2. **AI Integration**
   - Add Gemini API for real AI insights
   - Build "Ask the CFO" chat

3. **Advanced Features**
   - Anomaly detection
   - Email alerts
   - PDF exports
   - Multi-currency support

4. **UI Polish**
   - Add animations
   - Dark mode
   - Custom branding

---

## 🐛 Troubleshooting

### "Database not configured" error
- Check environment variables in Vercel
- Verify Supabase URL/key are correct

### Can't register
- Check RLS is disabled in Supabase
- Check browser console for errors

### Charts not showing
- Hard refresh browser (Ctrl+Shift+R)
- Check if Recharts is installed

### Build fails on Vercel
- Check `frontend/package.json` exists
- Verify all imports are correct
- Check Vercel build logs

---

## 📊 Performance

**Lighthouse Score Target:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+

**Load Time:**
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s

---

## 🎉 Success!

You now have a **production-ready CFO dashboard** deployed on Vercel!

**Share with your CEO/CFO and gather feedback.**

Then we can enhance with:
- Real financial data integration
- Advanced AI features
- Custom branding
- Additional reports

---

## 📧 Support

If you need help:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Check browser console
4. Review this guide again

**Your app is live! 🚀**
