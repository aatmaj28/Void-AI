# =============================================================================
# COLAB: Export S&P 500 to CSV — Run this entire file in a Google Colab cell
# =============================================================================
# 1. Run the cell. Wait ~5–10 min for all ~500 companies.
# 2. Download the generated CSV (sp500_companies_data.csv).
# 3. Put the CSV in your project: void ai/scripts/sp500_companies_data.csv
# 4. Locally run: python scripts/import_from_csv.py
# =============================================================================

import yfinance as yf
import pandas as pd
import time
import requests
from io import StringIO

# Config
SP500_CSV_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
DELAY = 0.2  # seconds between requests
PROGRESS_EVERY = 50
OUTPUT_CSV = "sp500_companies_data.csv"

# Fetch S&P 500 list from GitHub
print("Fetching S&P 500 list from GitHub...")
r = requests.get(SP500_CSV_URL, timeout=10)
r.raise_for_status()
df_list = pd.read_csv(StringIO(r.text))

# Normalize column names (repo uses Symbol, Security, GICS Sector, CIK)
if "Security" in df_list.columns and "Name" not in df_list.columns:
    df_list = df_list.rename(columns={"Security": "Name"})
if "GICS Sector" in df_list.columns and "Sector" not in df_list.columns:
    df_list = df_list.rename(columns={"GICS Sector": "Sector"})

tickers = df_list["Symbol"].tolist()
print(f"Loaded {len(tickers)} tickers. Starting yfinance fetch...\n")

companies = []
failed = []

for i, ticker in enumerate(tickers):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        name = info.get("longName") or info.get("shortName")
        sector = info.get("sector")
        industry = info.get("industry")
        market_cap = info.get("marketCap")
        exchange = info.get("exchange")
        country = info.get("country")
        row = df_list[df_list["Symbol"] == ticker].iloc[0]
        cik = row.get("CIK")
        if pd.notna(cik):
            cik = str(int(cik))
        else:
            cik = None
        companies.append({
            "ticker": ticker,
            "name": name,
            "sector": sector,
            "industry": industry,
            "market_cap": market_cap,
            "exchange": exchange,
            "country": country,
            "cik": cik,
            "is_active": True,
        })
        print(f"[{i+1}/{len(tickers)}] OK {ticker}: {name[:50] if name else 'N/A'}")
    except Exception as e:
        failed.append(ticker)
        row = df_list[df_list["Symbol"] == ticker].iloc[0]
        companies.append({
            "ticker": ticker,
            "name": row.get("Name") or row.get("Security"),
            "sector": row.get("Sector") or row.get("GICS Sector"),
            "industry": None,
            "market_cap": None,
            "exchange": None,
            "country": None,
            "cik": str(int(row["CIK"])) if pd.notna(row.get("CIK")) else None,
            "is_active": True,
        })
        print(f"[{i+1}/{len(tickers)}] FAIL {ticker} (using CSV fallback): {e}")
    if (i + 1) % PROGRESS_EVERY == 0:
        print(f"  --- Progress: {i+1}/{len(tickers)} ---")
    time.sleep(DELAY)

out = pd.DataFrame(companies)
out.to_csv(OUTPUT_CSV, index=False)
print(f"\nDone. Saved {len(companies)} rows to {OUTPUT_CSV}")
if failed:
    print(f"Failed yfinance for {len(failed)} tickers (CSV fallback used): {failed[:20]}{'...' if len(failed) > 20 else ''}")

# Download the file in Colab
try:
    from google.colab import files
    files.download(OUTPUT_CSV)
    print("Download started. Put the file in: void ai/scripts/sp500_companies_data.csv")
except Exception:
    print("Not in Colab — download the file manually and put it in scripts/sp500_companies_data.csv")
