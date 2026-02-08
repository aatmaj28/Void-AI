# =============================================================================
# COLAB: Export Market Data + Stock Metrics to CSV — Run entire file in Colab
# =============================================================================
# 1. Run the cell. Wait ~10–20 min for all ~500 tickers (1y history each).
# 2. Download the two CSVs: market_data.csv, stock_metrics.csv
# 3. Put them in your project: void ai/scripts/
# 4. Locally run: python scripts/import_market_data.py
#    (Imports into market_data and stock_metrics; tickers join with companies)
# =============================================================================

import yfinance as yf
import pandas as pd
import numpy as np
import time
import requests
from io import StringIO

# Config
SP500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
DELAY = 0.15  # seconds between tickers
PROGRESS_EVERY = 50
MARKET_DATA_CSV = "market_data.csv"
STOCK_METRICS_CSV = "stock_metrics.csv"

# Fetch S&P 500 tickers
print("Fetching S&P 500 list from GitHub...")
r = requests.get(SP500_URL, timeout=10)
r.raise_for_status()
df_list = pd.read_csv(StringIO(r.text))
tickers = df_list["Symbol"].tolist()
print(f"Loaded {len(tickers)} tickers. Fetching 1y history and computing metrics...\n")

all_market_data = []
all_metrics = []
failed_tickers = []

for i, ticker in enumerate(tickers):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")

        if hist.empty or len(hist) < 5:
            print(f"[{i+1}/{len(tickers)}] {ticker}: No data")
            failed_tickers.append(ticker)
            time.sleep(DELAY)
            continue

        # Daily OHLCV rows for market_data
        for date_ts, row in hist.iterrows():
            vol = row.get("Volume")
            if pd.isna(vol):
                vol = 0
            vol = int(vol)
            all_market_data.append({
                "ticker": ticker,
                "date": date_ts.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": vol,
            })

        # Metrics for stock_metrics
        hist = hist.copy()
        hist["returns"] = hist["Close"].pct_change()
        vol_tail = hist["Volume"].tail(20)
        avg_volume_20d = int(vol_tail.mean()) if vol_tail.notna().any() else 0
        ret_tail = hist["returns"].tail(20).dropna()
        volatility_20d = float(ret_tail.std() * np.sqrt(252)) if len(ret_tail) >= 2 else 0.0
        volatility_20d = round(volatility_20d, 4)

        current_price = round(float(hist["Close"].iloc[-1]), 4)
        price_1m_ago = hist["Close"].iloc[-21] if len(hist) >= 21 else hist["Close"].iloc[0]
        price_3m_ago = hist["Close"].iloc[-63] if len(hist) >= 63 else hist["Close"].iloc[0]
        price_change_1m = round((current_price - price_1m_ago) / price_1m_ago, 4) if price_1m_ago else 0.0
        price_change_3m = round((current_price - price_3m_ago) / price_3m_ago, 4) if price_3m_ago else 0.0
        year_high = round(float(hist["High"].max()), 4)
        year_low = round(float(hist["Low"].min()), 4)

        all_metrics.append({
            "ticker": ticker,
            "avg_volume_20d": avg_volume_20d,
            "volatility_20d": volatility_20d,
            "price_change_1m": price_change_1m,
            "price_change_3m": price_change_3m,
            "current_price": current_price,
            "year_high": year_high,
            "year_low": year_low,
        })

        if (i + 1) % PROGRESS_EVERY == 0:
            print(f"Processed {i + 1}/{len(tickers)} stocks...")
    except Exception as e:
        print(f"[{i+1}/{len(tickers)}] {ticker}: Error - {e}")
        failed_tickers.append(ticker)

    time.sleep(DELAY)

# Save CSVs
market_df = pd.DataFrame(all_market_data)
metrics_df = pd.DataFrame(all_metrics)
market_df.to_csv(MARKET_DATA_CSV, index=False)
metrics_df.to_csv(STOCK_METRICS_CSV, index=False)

print(f"\n--- COMPLETE ---")
print(f"Stocks with metrics: {len(all_metrics)}")
print(f"Failed: {len(failed_tickers)}")
print(f"Total market_data rows: {len(all_market_data)}")
print(f"Saved: {MARKET_DATA_CSV}, {STOCK_METRICS_CSV}")

# Download in Colab
try:
    from google.colab import files
    files.download(MARKET_DATA_CSV)
    files.download(STOCK_METRICS_CSV)
    print("Downloads started. Put both files in: void ai/scripts/")
except Exception:
    print("Not in Colab — copy market_data.csv and stock_metrics.csv to scripts/")
