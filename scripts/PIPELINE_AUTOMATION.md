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

## Option A: GitHub Actions (recommended, free)

The workflow runs on a schedule and can be triggered manually.

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
- If Yahoo rate-limits from GitHub IP, increase `DELAY_SECONDS` in the workflow env (e.g. `0.5` or `0.6`).

---

## Option B: Run the script locally on a schedule

On a machine that’s on at 6 AM (e.g. your PC or a home server):

**Windows (Task Scheduler):**

1. Create a batch file, e.g. `run_pipeline.bat`:
   ```bat
   cd /d "D:\path\to\void ai"
   python scripts/pipeline_daily.py
   ```
2. Task Scheduler → Create Task → Trigger: Daily at 6:00 AM → Action: run `run_pipeline.bat`.

**macOS / Linux (cron):**

```bash
# Edit crontab: crontab -e
# Run at 6:00 AM every day (adjust path and timezone)
0 6 * * * cd /path/to/void-ai && /usr/bin/python3 scripts/pipeline_daily.py
```

Ensure `.env.local` (or env vars) has `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## Option C: Cloud worker (Railway, Render, etc.)

If you want a dedicated server that runs the pipeline on a schedule:

1. **Railway / Render / Fly.io**: Create a project that runs a cron job or a small app with a scheduler.
2. **Cron job** (if the platform supports it): run `python scripts/pipeline_daily.py` at 6 AM.
3. **Env vars**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the project’s environment.

Example **Railway** cron (if using a cron service): same as Option B, but the command runs inside the cloud environment.

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

| Method              | Pros                    | Cons                          |
|---------------------|-------------------------|-------------------------------|
| **GitHub Actions**  | Free, no server to run  | Subject to Yahoo rate limits  |
| **Local cron**      | Full control, your IP   | PC must be on at 6 AM         |
| **Cloud worker**    | Reliable, separate IP   | Small monthly cost            |

For most cases, **GitHub Actions** is enough: add the two Supabase secrets and push the workflow; the pipeline runs every morning and users see updated data.
