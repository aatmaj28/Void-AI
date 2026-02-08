# =============================================================================
# COLAB: Export Analyst Coverage to CSV — Run entire file in Colab
# =============================================================================
# 1. Run the cell. Wait ~2–5 min for all ~500 tickers.
# 2. Download the CSV: analyst_coverage.csv
# 3. Put it in your project: void ai/scripts/
# 4. Locally run: python scripts/import_analyst_coverage.py
#    (Imports into analyst_coverage; tickers join with companies)
# =============================================================================

import yfinance as yf
import pandas as pd
import time
import requests
from io import StringIO

# Config
SP500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
DELAY = 0.15
PROGRESS_EVERY = 50
OUTPUT_CSV = "analyst_coverage.csv"

# Fetch S&P 500 tickers
print("Fetching S&P 500 list from GitHub...")
r = requests.get(SP500_URL, timeout=10)
r.raise_for_status()
df_list = pd.read_csv(StringIO(r.text))
tickers = df_list["Symbol"].tolist()
print(f"Fetching analyst coverage for {len(tickers)} stocks...\n")

analyst_data = []
failed = []

for i, ticker in enumerate(tickers):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        analyst_count = info.get("numberOfAnalystOpinions")
        if analyst_count is None or (isinstance(analyst_count, float) and pd.isna(analyst_count)):
            analyst_count = 0
        else:
            analyst_count = int(analyst_count)

        rec = {
            "ticker": ticker,
            "analyst_count": analyst_count,
            "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": info.get("recommendationMean"),
            "target_mean_price": info.get("targetMeanPrice"),
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
        }
        analyst_data.append(rec)

        if (i + 1) % PROGRESS_EVERY == 0:
            print(f"Processed {i + 1}/{len(tickers)} stocks...")
    except Exception as e:
        print(f"[{i+1}/{len(tickers)}] {ticker}: {e}")
        failed.append(ticker)

    time.sleep(DELAY)

# Save CSV
df = pd.DataFrame(analyst_data)
df.to_csv(OUTPUT_CSV, index=False)

print(f"\n--- COMPLETE ---")
print(f"Success: {len(analyst_data)}")
print(f"Failed: {len(failed)}")
print(f"Saved: {OUTPUT_CSV}")

if len(analyst_data) > 0:
    print(f"\n--- ANALYST COVERAGE STATS ---")
    print(f"Average analysts per stock: {df['analyst_count'].mean():.1f}")
    print(f"Max analysts: {df['analyst_count'].max()}")
    print(f"Min analysts: {df['analyst_count'].min()}")
    print(f"Stocks with 0 analysts: {len(df[df['analyst_count'] == 0])}")
    print(f"Stocks with 1-5 analysts: {len(df[(df['analyst_count'] >= 1) & (df['analyst_count'] <= 5)])}")
    print(f"Stocks with 10+ analysts: {len(df[df['analyst_count'] >= 10])}")

# Download in Colab
try:
    from google.colab import files
    files.download(OUTPUT_CSV)
    print("\nDownload started. Put the file in: void ai/scripts/")
except Exception:
    print("\nNot in Colab — copy analyst_coverage.csv to scripts/")
