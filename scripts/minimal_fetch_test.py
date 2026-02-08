#!/usr/bin/env python3
"""
Minimal test: fetch top 10 S&P 500 tickers and their latest close. Print only.
No Supabase, no CSVs. Use this to see if yfinance returns any data from your machine.
"""
import os
import requests
import yfinance as yf
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
df = __import__("pandas").read_csv(StringIO(r.text))
tickers = df["Symbol"].tolist()[:LIMIT]

print("Tickers:", tickers)
print()

for t in tickers:
    try:
        stock = yf.Ticker(t)
        hist = stock.history(period="5d")  # just 5 days
        if hist is not None and not hist.empty:
            close = hist["Close"].iloc[-1]
            print(f"  {t}: ${close:.2f}")
        else:
            print(f"  {t}: (no data)")
    except Exception as e:
        print(f"  {t}: ERROR - {e}")

print("\nDone.")
