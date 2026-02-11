# Automated Daily Pipeline

Run fresh data fetch + scoring **every morning** so users see updated info without using Colab.

---

## What the pipeline does

1. **Fetches S&P 500 tickers** from GitHub.
2. **For each ticker** (with a delay to reduce rate limits):
   - yfinance `history(period="1y")` → **market_data** (daily OHLCV) + **stock_metrics** (volatility, price change, etc.).
   - yfinance `info` → **analyst_coverage** (analyst count, targets).
3. **Upserts** into Supabase: `market_data`, `stock_metrics`, `analyst_coverage`.
4. **Runs the scoring engine** → computes coverage/activity/quality/gap scores and upserts **coverage_gap_scores**.

**Runtime:** ~15–30 minutes for ~500 tickers (depends on delay and rate limits).

---

## Option A: GitHub Actions (free, but often 429)

The workflow runs on a schedule and can be triggered manually. **Note:** Yahoo Finance often returns **429 Too Many Requests** when the pipeline runs on GitHub’s IP. If that happens, use **Option D (Railway or Render)** instead — same script, different IP, no 429.

### 1. Add secrets

In your GitHub repo:

1. **Settings → Secrets and variables → Actions**
2. **New repository secret** for each:
   - `SUPABASE_URL` — e.g. `https://xxxx.supabase.co`
   - `SUPABASE_ANON_KEY` — your Supabase anon key

### 2. Schedule (6 AM)

- Workflow file: **`.github/workflows/daily-pipeline.yml`**
- Default schedule: **11:00 UTC** (6:00 AM Eastern in winter).
- To change time: edit the `cron` in the workflow. Examples:
  - 6:00 AM Eastern (EST): `"0 11 * * *"`
  - 6:00 AM Eastern (EDT): `"0 10 * * *"`
  - 6:00 AM India: `"0 0 * * *"` (00:30 UTC)

### 3. Manual run

- **Actions** tab → **Daily Pipeline** → **Run workflow** → **Run workflow**

### 4. Notes

- **companies** table is not updated by this pipeline (S&P 500 list is relatively static). Populate it once (e.g. Colab export + import) or add a step to refresh from the same GitHub CSV if you want.
- If Yahoo returns **429** from GitHub’s IP, the job will fail (we exit with code 1 when too many tickers fail). Use **Option D: Railway or Render** for a reliable daily run — see [PIPELINE_RAILWAY_CRON.md](PIPELINE_RAILWAY_CRON.md).

---

## Option B: Run the script locally on a schedule (reliable when cloud gets 429)

If Yahoo returns **429** on both GitHub Actions and Render (or Railway), the only reliable way to run the pipeline with free Yahoo data is **on your own machine**. On a machine that's on at your chosen time (e.g. your PC at 6 AM):

**Windows (Task Scheduler):** Use the batch file **`run_pipeline.bat`** in the repo root, then schedule it in Task Scheduler. **Full steps:** [PIPELINE_TASK_SCHEDULER_WINDOWS.md](PIPELINE_TASK_SCHEDULER_WINDOWS.md)

**macOS / Linux (cron):**

```bash
# Edit crontab: crontab -e
# Run at 6:00 AM every day (adjust path and timezone)
0 6 * * * cd /path/to/void-ai && /usr/bin/python3 scripts/pipeline_daily.py
```

Ensure `.env.local` (or env vars) has `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## Option C: Railway or Render (cron worker — try if GitHub gets 429)

Use a **cron job** on Railway or Render so the pipeline runs from their IP instead of GitHub’s. **Yahoo often returns 429 on these IPs too**; if you get 429 on both GitHub and Render, use **Option B (local schedule)** instead.

- **Railway:** Connect repo → use `Dockerfile.pipeline` → add env vars → set cron (e.g. `0 9 * * *`).
- **Render:** New Cron Job → connect repo → Python + `pip install -r scripts/requirements.txt`, command `python scripts/pipeline_daily.py` → add env vars → set schedule.

**Step-by-step:** [PIPELINE_RAILWAY_CRON.md](PIPELINE_RAILWAY_CRON.md)

---

## Pipeline script usage

**Run once (e.g. for testing):**

```bash
cd "path/to/void ai"
pip install -r scripts/requirements.txt
# Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local or env
python scripts/pipeline_daily.py
```

**Optional env vars:**

- `DELAY_SECONDS` — seconds between tickers (default `0.35`). Increase if you hit rate limits.
- `PROGRESS_EVERY` — log progress every N tickers (default `50`).

---

## Summary

| Method                | Pros                     | Cons                           |
|-----------------------|--------------------------|--------------------------------|
| **GitHub Actions**    | Free, no server          | Yahoo often 429s GitHub’s IP   |
| **Local cron**        | Full control, your IP    | PC must be on at run time      |
| **Railway / Render**  | Reliable, dedicated IP   | Free tier or small monthly cost |

If GitHub Actions hits **429**, try **Railway or Render** (Option C); if they get 429 too, use **local schedule** (Option B). See [PIPELINE_RAILWAY_CRON.md](PIPELINE_RAILWAY_CRON.md) for cloud setup.
