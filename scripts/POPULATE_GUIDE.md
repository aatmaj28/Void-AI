# S&P 500 Data Population

You can: **Colab export → CSV → import** (recommended), **one-step populate** (local yfinance → DB), or **local fetch to CSV → import**.

---

## Option A: Colab export → CSV → Import (recommended if local hits rate limits)

1. **In Google Colab:** Open `scripts/colab_export_sp500.py`, copy the whole file into a Colab cell, and run it. Wait ~5–10 min for all ~500 companies. Download the generated `sp500_companies_data.csv`.
2. **Locally:** Put the CSV in your project as `scripts/sp500_companies_data.csv`.
3. **Import into Supabase:** From project root run `python scripts/import_from_csv.py` (or `python scripts/import_from_csv.py --file path/to/your.csv`). Uses **upsert** on `ticker`; batches of 100. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local`.

---

## Option B: One-Step Populate (GitHub + yfinance → DB, local)

Fetches the S&P 500 list from GitHub, gets live data from yfinance for each ticker, and upserts into the `companies` table. Matches the “Step 2” plan: CIK from CSV, name/sector/industry/market_cap/exchange/country from yfinance.

### Run from project root

```bash
# Install dependencies (one time)
pip install -r scripts/requirements.txt

# Test with first 10 stocks
python scripts/populate_companies.py --test

# Limit to 50 stocks
python scripts/populate_companies.py --limit 50

# Full run (~500 companies, ~5–10 min)
python scripts/populate_companies.py
```

- Progress is printed every **50** stocks.
- Failed tickers are logged to `scripts/failed_tickers.log`.
- Uses **upsert** on `ticker` (insert if new, update if exists).
- Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local`.

---

## Option C: Two-Step Process (local fetch to CSV → Import)

This two-step process is more reliable if you hit rate limits; create the CSV once, then import.

---

## Step 1: Fetch Data to CSV

Fetch all S&P 500 company data from yfinance and save to a local CSV file:

### Test Mode (Recommended First)
```bash
python scripts/fetch_to_csv.py --test
```
This fetches only 10 companies to verify everything works.

### Limited Run
```bash
python scripts/fetch_to_csv.py --limit 50
```

### Full Run (~500 companies)
```bash
python scripts/fetch_to_csv.py
```

**Output:** Creates `scripts/sp500_companies_data.csv`

**Time:** ~5-10 minutes for full run (0.5s delay between requests)

---

## Step 2: Import CSV to Supabase

Once you have the CSV file, import it to your database:

```bash
python scripts/import_from_csv.py
```

**Features:**
- ✅ Bulk import in batches of 100 records
- ✅ Automatic retry for failed batches
- ✅ Upsert logic (updates existing, inserts new)
- ✅ Fast and reliable

**Time:** ~10-30 seconds

---

## 🔍 Verify Data

After import, verify the data quality:

```bash
python scripts/verify_data.py
```

---

## 📊 What You Get

**CSV File Contains:**
- ticker (e.g., "AAPL")
- name (e.g., "Apple Inc.")
- sector (e.g., "Technology")
- industry (e.g., "Consumer Electronics")
- market_cap (in dollars)
- exchange (e.g., "NMS")
- country (e.g., "United States")
- cik (SEC filing number)
- is_active (boolean)

---

## ✅ Advantages of This Approach

1. **No Rate Limiting Issues** - CSV file is created once, can be imported multiple times
2. **Reusable Data** - Keep the CSV for future use or analysis
3. **Faster Imports** - Bulk import is much faster than individual inserts
4. **Better Error Handling** - Failed fetches use CSV fallback data
5. **Testable** - Can test import with small CSV files first

---

## 🔄 Complete Workflow

```bash
# 1. Install dependencies (one time)
pip install -r scripts/requirements.txt

# 2. Fetch data to CSV
python scripts/fetch_to_csv.py

# 3. Import CSV to database
python scripts/import_from_csv.py

# 4. Verify data
python scripts/verify_data.py
```

---

## 🛠️ Troubleshooting

**CSV file not found**
- Run `fetch_to_csv.py` first to create the CSV

**Import fails with permission error**
- Check that SUPABASE_URL and SUPABASE_ANON_KEY are in `.env.local`
- Verify the companies table exists in Supabase

**Some tickers failed to fetch**
- Normal! Some tickers may have API issues
- The script uses CSV fallback data (name, sector from original CSV)
- You can re-run `fetch_to_csv.py` to retry failed tickers
