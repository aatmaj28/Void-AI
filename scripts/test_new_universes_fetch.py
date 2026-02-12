#!/usr/bin/env python3
"""
Test the 2 new ticker sources: Russell 2000 (small cap) and S&P 400 (mid cap).

Fetches 5 tickers from each source, runs the same yfinance fetch as pipeline_daily,
and reports whether we get full data (market_data + stock_metrics) for each.
Use this to confirm both new universes work before running a full multi-universe pipeline.

Usage (from project root):
  python scripts/test_new_universes_fetch.py

Optional env:
  N_PER_SOURCE=5   number of tickers to test per source (default 5)
  RUSSELL_SAMPLE=15  number of Russell 2000 tickers to try (default 15; list can have delisted names, so we try extra to get 5 OK)
"""

import os
import sys

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
sys.path.insert(0, _script_dir)

# Import after path is set; pipeline_daily sets up yfinance cache and fetch logic
import pipeline_daily as p

N_PER_SOURCE = int(os.getenv("N_PER_SOURCE", "5"))
# Russell 2000 CSV (ikoniaris) can have many delisted tickers; sample more to get 5 with data
RUSSELL_SAMPLE = int(os.getenv("RUSSELL_SAMPLE", "15"))


def run_one(ticker: str, label: str, index: int, total: int):
    """Fetch one ticker and print OK/FAIL line. Returns True if OK."""
    print(f"  [{index}/{total}] {ticker} ({label})...", end=" ", flush=True)
    market_rows, metrics_row, analyst_row, _ = p.fetch_one_ticker(ticker)
    n_market = len(market_rows)
    if metrics_row and n_market >= 5:
        cur = metrics_row.get("current_price")
        vol = metrics_row.get("volume")
        avg_vol = metrics_row.get("avg_volume_20d")
        pe = metrics_row.get("pe_ratio")
        ac = analyst_row.get("analyst_count", 0) if analyst_row else 0
        first_date = market_rows[0]["date"] if market_rows else ""
        last_date = market_rows[-1]["date"] if market_rows else ""
        pe_str = pe if pe is not None else "None"
        print(f"OK — {n_market} days, price={cur}, vol={vol}, avg_vol_20d={avg_vol}, pe={pe_str}, analysts={ac}, range={first_date}..{last_date}")
        return True
    print(f"FAIL — no metrics or insufficient history (market_rows={n_market})")
    return False


def main():
    print("Testing 2 new universes: Russell 2000 (small cap) + S&P 400 (mid cap)\n")
    print("Fetching ticker lists from sources...")

    try:
        russell_tickers = p._fetch_russell2000()
        sp400_tickers = p._fetch_sp400()
    except Exception as e:
        print(f"Error fetching ticker lists: {e}")
        sys.exit(1)

    n_sp400 = min(N_PER_SOURCE, len(sp400_tickers))
    n_russell = min(RUSSELL_SAMPLE, len(russell_tickers))
    # Sample from start and from middle of Russell list (start can have many delisted)
    half = len(russell_tickers) // 2
    russell_sample = (
        russell_tickers[: n_russell // 2]
        + russell_tickers[half : half + n_russell - n_russell // 2]
    )[:n_russell]
    sp400_sample = sp400_tickers[:n_sp400]

    print(f"Russell 2000: trying {n_russell} tickers (list may include delisted): {russell_sample[:5]}... {russell_sample[-3:]}")
    print(f"S&P 400:      using first {n_sp400} of {len(sp400_tickers)} tickers: {sp400_sample}\n")

    total_tested = len(russell_sample) + len(sp400_sample)
    idx = 0

    # Russell 2000 (small cap)
    print("--- Russell 2000 (small cap) ---")
    russell_ok = 0
    for i, ticker in enumerate(russell_sample):
        idx += 1
        if run_one(ticker, "Russell 2000", idx, total_tested):
            russell_ok += 1

    # S&P 400 (mid cap)
    print("\n--- S&P 400 (mid cap) ---")
    sp400_ok = 0
    for i, ticker in enumerate(sp400_sample):
        idx += 1
        if run_one(ticker, "S&P 400", idx, total_tested):
            sp400_ok += 1

    print("\n" + "=" * 50)
    print(f"Russell 2000 (small cap): {russell_ok}/{len(russell_sample)} tickers got full data")
    print(f"S&P 400 (mid cap):       {sp400_ok}/{len(sp400_sample)} tickers got full data")
    if russell_ok >= 5 and sp400_ok >= 5:
        print("PASS: At least 5 from each source returned values.")
    else:
        print("Check failures above; Russell 2000 list may include delisted symbols.")
    print("\nDone.")


if __name__ == "__main__":
    main()
