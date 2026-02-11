# Run the Daily Pipeline on Railway or Render (Cron Worker)

When **GitHub Actions** hits **429 Too Many Requests** from Yahoo Finance, you can try running the **same pipeline** on **Railway** or **Render** as a scheduled cron job (different IP than GitHub). **Note:** Yahoo often blocks or rate-limits **many cloud IPs** (GitHub, Render, Railway, etc.). If you get 429 on Render too, the reliable option is **running the pipeline locally on a schedule** (see below).

---

## Why use a worker? (and when it doesn’t help)

| Where              | Result |
|--------------------|--------|
| **Your terminal / laptop** | Works — your home or office IP is usually allowed by Yahoo. |
| **GitHub Actions** | Often 429 — Yahoo rate-limits/blocks GitHub’s IP. |
| **Railway / Render** | **Sometimes** works; often 429 as well — Yahoo blocks many cloud IPs. |

If the pipeline works on your laptop but fails with 429 on **both** GitHub and Render, Yahoo is blocking those cloud IPs. In that case, **run the pipeline locally on a schedule** (e.g. Windows Task Scheduler or cron) when your machine is on — see [PIPELINE_AUTOMATION.md](PIPELINE_AUTOMATION.md) Option B.

---

## Option 1: Railway

### 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. **New Project** → **Deploy from GitHub repo**.
3. Select **Void-AI** (or your fork). Connect the repo.

### 2. Use the pipeline Dockerfile

Railway will detect a Dockerfile. We use a **separate** Dockerfile for the pipeline so the main app is unchanged:

- In Railway, either:
  - Set **Dockerfile path** to `Dockerfile.pipeline`, or  
  - Add a **Cron Job** and set the **Build** to use `Dockerfile.pipeline` (if your UI has a “Dockerfile” or “Docker path” field).

If Railway doesn’t let you pick a second Dockerfile easily:

- Create a **new service** in the same project.
- In that service: **Settings** → **Build** → set **Dockerfile path** to `Dockerfile.pipeline`, **Root Directory** to `/` (repo root).
- That service’s **Start Command** can stay as the Dockerfile `CMD` (run the pipeline once and exit).

### 3. Add environment variables

In the **pipeline** service (or Cron Job):

- **Variables** (or **Env**):
  - `SUPABASE_URL` = your Supabase project URL  
  - `SUPABASE_ANON_KEY` = your Supabase anon key  
- Optional:
  - `DELAY_SECONDS` = `0.35` (or `0.5` if you want to be gentler)
  - `FAIL_IF_FETCH_PCT` = `50`

No `.env` or `.env.local` in the container — Railway injects these.

### 4. Set the cron schedule

- In Railway, open the **Cron** (or **Cron Job**) for this service.
- Set schedule to run once per day, e.g.:
  - **9:00 AM UTC**: `0 9 * * *`
  - **9:00 AM Eastern (EST, UTC-5)**: `0 14 * * *`
  - **6:00 AM Eastern**: `0 11 * * *`
- The **command** should be the same as the image default: run the pipeline script (Railway often runs the container’s `CMD` when the cron fires).

If your plan has no “Cron” tab:

- You can still run the pipeline **manually** from the dashboard (Deploy → Run or “Run now”).
- Or use **Railway’s Cron** add-on / feature if available on your plan.

### 5. Deploy

- Push to the connected branch (e.g. `main`). Railway builds `Dockerfile.pipeline` and deploys.
- On the next cron trigger (or “Run now”), the container starts, runs `python scripts/pipeline_daily.py`, and exits. Tables update as when you run it locally.

---

## Option 2: Render (step-by-step)

### 1. Sign in and create a Cron Job

1. Go to **[render.com](https://render.com)** and sign in with **GitHub**.
2. In the dashboard, click **New +** → **Cron Job**.
3. If asked to connect a repo first, connect your **Void-AI** (or `aatmaj28/Void-AI`) GitHub repo and authorize Render.

### 2. Connect the repo and branch

- **Repository:** Select **Void-AI** (or your fork).
- **Branch:** e.g. `main` (or the branch you push pipeline changes to).
- Click **Connect** or **Continue**.

### 3. Build settings (use Docker)

- **Environment** or **Runtime:** choose **Docker**.
- **Dockerfile Path:** set to **`Dockerfile.pipeline`** (so Render uses the pipeline image, not a web app).
- **Docker Command** (if shown): you can leave empty — the Dockerfile `CMD` already runs `python scripts/pipeline_daily.py`. Or set: `python scripts/pipeline_daily.py`.

### 4. Cron schedule

- **Schedule:** enter a cron expression. All times are **UTC**.
  - **9:00 AM UTC daily:** `0 9 * * *`
  - **6:00 AM Eastern (EST, UTC-5) = 11:00 UTC:** `0 11 * * *`
  - **9:00 AM Eastern (EST) = 14:00 UTC:** `0 14 * * *`
- **Command:** if Render shows a “Command” field for the cron run, use:  
  `python scripts/pipeline_daily.py`  
  (or leave default if it runs the container’s CMD.)

### 5. Environment variables

In the cron job’s **Environment** (or **Environment Variables**) section, add:

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Optional:

- `DELAY_SECONDS` = `0.35` (or `0.5`)
- `FAIL_IF_FETCH_PCT` = `50`

Use the same values as in your `.env.local`. Do **not** commit `.env.local`; set these only in Render’s UI.

### 6. Instance and deploy

- **Instance type:** Free (or the smallest paid tier if you need more time). The pipeline usually finishes in under 15 minutes.
- Click **Create Cron Job** (or **Save**). Render will:
  - Build the image from `Dockerfile.pipeline`.
  - Run the cron on your schedule.
- To test immediately: open the cron job in the dashboard and click **Trigger Run**. Check the **Logs** tab for output (same as your terminal).

### 7. Check runs and logs

- **Dashboard** → your **Cron Job** → **Logs** (or **Runs**). Each run will show the same “Daily pipeline — fetch yfinance + Supabase + scoring” output as when you run locally.
- If a run fails, logs will show the error (e.g. missing env var or Yahoo/network issue).

---

## What runs (same as terminal)

The pipeline is the **same** as when you run it locally:

1. Fetch S&P 500 tickers from GitHub.  
2. For each ticker: `yf.download` + `stock.info` → market_data, stock_metrics, analyst_coverage.  
3. Upsert into Supabase.  
4. Run scoring engine → coverage_gap_scores.

So **Railway/Render only change where it runs (and thus the IP)**. No code change needed.

---

## Files added for this

- **`Dockerfile.pipeline`** — minimal image: Python 3.11, `scripts/requirements.txt`, `scripts/`, `supabase/`. `CMD` runs `python scripts/pipeline_daily.py`.
- **`.dockerignore`** — keeps the build context small (no `node_modules`, app UI, etc.).
- **`docs/PIPELINE_RAILWAY_CRON.md`** — this guide.

---

## Quick reference

| Step | Railway | Render |
|------|--------|--------|
| 1 | New Project → Deploy from GitHub | New → Cron Job → Connect repo |
| 2 | Use `Dockerfile.pipeline` for build | Use Dockerfile.pipeline or install deps + run script |
| 3 | Variables: SUPABASE_URL, SUPABASE_ANON_KEY | Same |
| 4 | Cron: e.g. `0 9 * * *` (9 AM UTC) | Same |
| 5 | Deploy / Run now | Deploy / Trigger run |

If you hit 429 on GitHub Actions, switching to Railway or Render as a cron worker is the recommended fix.
