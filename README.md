# VOID AI

> **We find alpha in the void**  
> Discover under-covered stocks where market activity is high but analyst attention is low.

Void AI is a full-stack investment intelligence platform that combines market data, analyst coverage signals, and AI-assisted workflows to surface actionable opportunities.

## What You Get

- **Coverage Gap Detection**: Finds stocks with strong activity and weak coverage.
- **Opportunity Scoring**: Ranks names by gap score and supporting metrics.
- **Dashboard & Heatmaps**: Visual overview of trends, sectors, and priority opportunities.
- **Advanced Screener**: Filter by sector, market cap, analyst coverage, and score thresholds.
- **Watchlists**: Save and organize tickers for ongoing tracking.
- **Alerts**: Personalized alerts for gap changes, volume spikes, and new opportunities.
- **Explore & Chat**: RAG-driven research flow for deeper ticker investigation.
- **Authentication & Profiles**: Email-based auth + user profile/settings pages.
- **Crypto Page**: Separate crypto-focused view integrated into app navigation.

## Tech Stack

### Frontend
- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS 4** + Radix UI components
- **Recharts** for data visualization
- **Framer Motion** + Three.js ecosystem (`@react-three/fiber`, `@react-three/drei`) for interactive visuals

### Backend / Data
- **Supabase** (Postgres + client library)
- Next.js API routes for opportunities, stock data, auth OTP, contact, and integrations
- Python data pipeline scripts for ingestion/scoring/automation

### Auth / Integrations
- `next-auth` + OAuth support hooks
- OTP/email flows via Nodemailer (Gmail app password setup)
- External market/news/research integrations (environment-variable driven)

## Core Application Routes

- `/` - Landing page with product overview
- `/dashboard` - Opportunity and alerts overview
- `/opportunities` - Ranked opportunity list
- `/screener` - Advanced filtering and saved screen workflows
- `/watchlist` - User watchlists and saved tickers
- `/alerts` - Alert center and preferences
- `/explore` - Research/chat experience
- `/stock/[ticker]` - Ticker detail pages
- `/settings` - User settings and account controls
- `/profile` - User profile
- `/crypto` - Crypto section

## Local Development

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment variables

Create `.env.local` in the project root.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (frontend) | Browser Supabase client URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (frontend) | Browser Supabase anon key |
| `SUPABASE_URL` | Yes (server/scripts) | Server-side Supabase URL |
| `SUPABASE_ANON_KEY` | Yes (server/scripts) | Server-side Supabase anon key |
| `NEXT_PUBLIC_RAG_API_URL` | Optional | RAG backend URL (defaults to localhost) |
| `FINNHUB_API_KEY` | Optional/Feature-based | Stock news API access |
| `SEC_USER_AGENT` | Optional/Feature-based | SEC API user-agent identifier |
| `GMAIL_USER` | Optional/Feature-based | Outbound email account |
| `GMAIL_APP_PASSWORD` | Optional/Feature-based | App password for mail transport |
| `AUTH_GOOGLE_ID` / `GOOGLE_CLIENT_ID` | Optional | Google OAuth client id |
| `AUTH_GOOGLE_SECRET` / `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |

### 3) Start development server

```bash
pnpm dev
```

App runs on [http://localhost:3000](http://localhost:3000).

## Available Scripts

```bash
pnpm dev           # Start dev server
pnpm build         # Build for production
pnpm start         # Run production build
pnpm lint          # Lint project
pnpm db:show-migration
```

## Database and Migrations

SQL migrations are versioned under `supabase/migrations/`.

Recent schema additions include:
- Saved screens
- Watchlists
- Users and profiles

If you are onboarding a fresh environment, apply these migrations before running the app features that depend on them.

## Deployment Notes (Vercel + Supabase)

- `main` is treated as production and triggers Vercel deploys.
- Ensure **Production** env vars include:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - plus server-side vars needed by API routes
- Missing `NEXT_PUBLIC_*` Supabase keys causes client runtime errors on pages like dashboard.

## Repository Layout

```text
app/                    Next.js routes (landing, app pages, auth, APIs)
components/             Reusable UI and feature components
lib/                    Data clients, API helpers, app utilities
scripts/                Data ingestion, scoring, automation scripts
supabase/migrations/    SQL migrations
```

## Team

**Developers:** Aatmaj Amol Salunke, Vijwal Mahendrakar  
**Course:** CS5130 - Applied Programming and Data Processing for AI  
**Institution:** Northeastern University (Spring 2026)
