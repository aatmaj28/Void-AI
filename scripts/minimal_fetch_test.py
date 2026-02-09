#!/usr/bin/env python3
"""
Minimal test: fetch top 10 S&P 500 tickers and their latest close. Print only.
No Supabase, no CSVs. Use this to see if yfinance returns any data from your machine.
"""
import os
import requests
import yfinance as yf
import pandas as pd
from io import StringIO

# Use project cache so yfinance can write (avoids "unable to open database file")
_here = os.path.dirname(os.path.abspath(__file__))
_cache = os.path.join(os.path.dirname(_here), ".yfinance_cache")
os.makedirs(_cache, exist_ok=True)
try:
    yf.set_tz_cache_location(_cache)
except Exception:
    pass

URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
LIMIT = 10

# Get tickers
r = requests.get(URL, timeout=10)
r.raise_for_status()
df = pd.read_csv(StringIO(r.text))
tickers = df["Symbol"].tolist()[:LIMIT]

print("Tickers:", tickers)
print()

for t in tickers:
    try:
        # IMPORTANT: do NOT pass a custom requests.Session here.
        # Let yfinance manage its own curl_cffi session internally, same as in yf_connectivity_test.py.
        hist = yf.download(t, period="5d", progress=False)
        if hist is not None and not hist.empty:
            # yfinance now often returns a MultiIndex for columns: level0 ('Price'), level1 (ticker).
            # Handle both simple and MultiIndex cases.
            close_val = None
            cols = hist.columns
            if isinstance(cols, pd.MultiIndex):
                # Try: level 0 = 'Close', level 1 = ticker symbol
                try:
                    series = hist["Close"][t]
                except Exception:
                    # Fallback: take the first column whose top-level name is 'Close'
                    close_sub = hist["Close"]
                    series = close_sub.iloc[:, 0]
                close_val = float(series.iloc[-1])
            else:
                close_val = float(hist["Close"].iloc[-1])

            print(f"  {t}: ${close_val:.2f}")
        else:
            print(f"  {t}: (no data)")
    except Exception as e:
        print(f"  {t}: ERROR - {e}")

print("\nDone.")
