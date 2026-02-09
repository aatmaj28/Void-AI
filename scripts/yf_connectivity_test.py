#!/usr/bin/env python3
"""
Connectivity test for yfinance vs raw requests.

This mirrors the behaviour you described in the stock_prices.py doc:
- First, hit a Yahoo Finance endpoint with plain requests and print the status code.
- Then, call yfinance *without* any custom session and see if it can download data.

Usage:
  python scripts/yf_connectivity_test.py
"""

import os
import requests
import yfinance as yf


def main():
    ticker = "AAPL"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"

    print("=== Raw requests test ===")
    try:
        resp = requests.get(url, timeout=10)
        print(f"Yahoo Finance Status: {resp.status_code}")
        if resp.status_code == 429:
            print("⚠️  Rate Limited - Your IP is blocked by Yahoo Finance (for this raw request).")
    except Exception as e:
        print(f"Error calling Yahoo with requests: {e}")

    # Ensure yfinance can write its cache locally
    here = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(os.path.dirname(here), ".yfinance_cache")
    os.makedirs(cache_dir, exist_ok=True)
    try:
        yf.set_tz_cache_location(cache_dir)
    except Exception:
        pass

    print("\n=== yfinance test (no custom session) ===")
    try:
        # DO NOT pass a custom requests.Session here; let yfinance manage curl_cffi itself.
        data = yf.download(ticker, period="5d", progress=False)
        if data is not None and not data.empty:
            print(f"✓ yfinance.download succeeded for {ticker}")
            print(data[["Open", "Close"]].tail().to_string())
        else:
            print(f"✗ yfinance.download returned no data for {ticker}")
    except Exception as e:
        print(f"Error in yfinance.download: {e}")


if __name__ == "__main__":
    main()

