#!/usr/bin/env python3
"""
Test pipeline: fetch data for 50 tickers only (same logic as pipeline_daily.py).

Use this to verify yfinance is returning the data we need and to check for rate limits
before running the full 500-ticker pipeline.

Usage:
  python scripts/test_pipeline_50.py              # Fetch only, print summary + save CSVs
  python scripts/test_pipeline_50.py --push      # Also upsert to Supabase (optional)
  python scripts/test_pipeline_50.py --debug     # Diagnose why fetch fails locally (1 ticker, full traceback)

Output:
  - Prints: tickers fetched, market_data rows, metrics count, analyst count, any errors
  - Saves (in scripts/): test_market_data.csv, test_stock_metrics.csv, test_analyst_coverage.csv

Env: SUPABASE_URL, SUPABASE_ANON_KEY (only needed for --push)
Optional: DELAY_SECONDS=0.5  (increase if you see rate limits, e.g. 1.0)

Why it can fail locally:
  1. yfinance cache: we set cache to project .yfinance_cache so SQLite can write.
  2. Yahoo 429 / empty data: your IP may be rate-limited. Use longer DELAY or run
     the pipeline from GitHub Actions / Colab (different IP). Run with --debug
     to see hist/info and any exception.
"""

import os
import sys
import time
import argparse
import requests
import pandas as pd
import numpy as np
import yfinance as yf
from io import StringIO
from datetime import datetime
from dotenv import load_dotenv

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, ".env.local"))

# Use a writable cache dir in the project so yfinance works locally (avoids "unable to open database file")
_yf_cache = os.path.join(_project_root, ".yfinance_cache")
os.makedirs(_yf_cache, exist_ok=True)
try:
    yf.set_tz_cache_location(_yf_cache)
except Exception:
    pass

SP500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
TEST_LIMIT = 50
DELAY = float(os.getenv("DELAY_SECONDS", "0.5"))
PROGRESS_EVERY = 10


def fetch_tickers(limit: int):
    r = requests.get(SP500_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    return df["Symbol"].tolist()[:limit]


def fetch_one_ticker(ticker: str, debug: bool = False):
    """Same logic as pipeline_daily: history(1y) + info. Returns (market_rows, metrics_row, analyst_row)."""
    try:
        stock = yf.Ticker(ticker)
        if debug:
            print(f"\n--- DEBUG: {ticker} ---")
            print(f"  stock type: {type(stock)}")
        hist = stock.history(period="1y")
        if debug:
            print(f"  hist type: {type(hist)}")
            print(f"  hist is None: {hist is None}")
            if hist is not None:
                print(f"  hist.empty: {hist.empty}")
                print(f"  len(hist): {len(hist)}")
                if not hist.empty:
                    print("  hist.head():")
                    print(hist.head().to_string())
                else:
                    print("  hist (empty):", hist)
            else:
                print("  hist: None")
        info = getattr(stock, "info", None) or {}
        if debug:
            print(f"  info type: {type(info)}")
            if isinstance(info, dict):
                print(f"  info keys (first 20): {list(info.keys())[:20]}")
                print(f"  numberOfAnalystOpinions: {info.get('numberOfAnalystOpinions')}")
            else:
                print(f"  info: {info}")
            print("--- END DEBUG ---\n")

        market_rows = []
        metrics_row = None
        analyst_row = None

        if hist is not None and not hist.empty and len(hist) >= 5:
            for date_ts, row in hist.iterrows():
                vol = row.get("Volume")
                vol = 0 if (vol is None or (isinstance(vol, float) and np.isnan(vol))) else int(vol)
                market_rows.append({
                    "ticker": ticker,
                    "date": date_ts.strftime("%Y-%m-%d"),
                    "open": round(float(row["Open"]), 4),
                    "high": round(float(row["High"]), 4),
                    "low": round(float(row["Low"]), 4),
                    "close": round(float(row["Close"]), 4),
                    "volume": vol,
                })
            hist = hist.copy()
            hist["returns"] = hist["Close"].pct_change()
            vol_tail = hist["Volume"].tail(20)
            avg_vol = int(vol_tail.mean()) if vol_tail.notna().any() else 0
            ret_tail = hist["returns"].tail(20).dropna()
            vol_20 = float(ret_tail.std() * np.sqrt(252)) if len(ret_tail) >= 2 else 0.0
            vol_20 = round(vol_20, 4)
            cur = round(float(hist["Close"].iloc[-1]), 4)
            pc1 = hist["Close"].pct_change(21).iloc[-1] if len(hist) >= 22 else np.nan
            pc3 = hist["Close"].pct_change(63).iloc[-1] if len(hist) >= 64 else np.nan
            ch1 = round(float(pc1), 4) if pd.notna(pc1) else 0.0
            ch3 = round(float(pc3), 4) if pd.notna(pc3) else 0.0
            yh = round(float(hist["High"].max()), 4)
            yl = round(float(hist["Low"].min()), 4)
            metrics_row = {
                "ticker": ticker,
                "avg_volume_20d": avg_vol,
                "volatility_20d": vol_20,
                "price_change_1m": ch1,
                "price_change_3m": ch3,
                "current_price": cur,
                "year_high": yh,
                "year_low": yl,
                "updated_at": datetime.utcnow().isoformat(),
            }

        ac = info.get("numberOfAnalystOpinions")
        ac = 0 if (ac is None or (isinstance(ac, float) and np.isnan(ac))) else int(ac)
        analyst_row = {
            "ticker": ticker,
            "analyst_count": ac,
            "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": info.get("recommendationMean"),
            "target_mean_price": info.get("targetMeanPrice"),
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
            "updated_at": datetime.utcnow().isoformat(),
        }
        return (market_rows, metrics_row, analyst_row)
    except Exception as e:
        if debug:
            import traceback
            print(f"\n--- EXCEPTION for {ticker} ---")
            traceback.print_exc()
            print("--- END EXCEPTION ---\n")
        return ([], None, {"ticker": ticker, "analyst_count": 0, "updated_at": datetime.utcnow().isoformat()})


def main():
    parser = argparse.ArgumentParser(description="Test pipeline: fetch 50 tickers only")
    parser.add_argument("--push", action="store_true", help="Upsert results to Supabase")
    parser.add_argument("--limit", type=int, default=TEST_LIMIT, help=f"Number of tickers (default {TEST_LIMIT})")
    parser.add_argument("--debug", action="store_true", help="Diagnose local fetch: 1 ticker, print hist/info and full traceback on error")
    args = parser.parse_args()

    if args.debug:
        print("Diagnostic mode: fetching 1 ticker (MMM) with full debug output.\n")
        tickers = ["MMM"]
        debug = True
    else:
        print("Test pipeline — fetching data for", args.limit, "tickers (same logic as daily pipeline)\n")
        print("Delay between tickers:", DELAY, "s\n")
        tickers = fetch_tickers(args.limit)
        print("Tickers:", tickers[:10], "...\n")
        debug = False

    all_market = []
    all_metrics = []
    all_analyst = []
    failed = []
    start = time.time()

    for i, ticker in enumerate(tickers):
        market_rows, metrics_row, analyst_row = fetch_one_ticker(ticker, debug=debug)
        all_market.extend(market_rows)
        if metrics_row:
            all_metrics.append(metrics_row)
        if analyst_row:
            all_analyst.append(analyst_row)
        if not market_rows:
            failed.append((ticker, "no history"))
        if (i + 1) % PROGRESS_EVERY == 0 and not debug:
            elapsed = time.time() - start
            print(f"  [{i+1}/{len(tickers)}] market rows: {len(all_market)}, metrics: {len(all_metrics)}, elapsed: {elapsed:.0f}s")
        if not debug:
            time.sleep(DELAY)

    elapsed = time.time() - start
    print("\n--- FETCH DONE ---")
    print(f"  Tickers requested: {len(tickers)}")
    print(f"  Market data rows: {len(all_market)}")
    print(f"  Stock metrics rows: {len(all_metrics)}")
    print(f"  Analyst coverage rows: {len(all_analyst)}")
    print(f"  Failed / no data: {len(failed)}")
    print(f"  Time: {elapsed:.1f}s")
    if failed:
        print("  Failed tickers:", [f[0] for f in failed[:15]], "..." if len(failed) > 15 else "")

    # Save CSVs for inspection
    out_dir = _script_dir
    market_path = os.path.join(out_dir, "test_market_data.csv")
    metrics_path = os.path.join(out_dir, "test_stock_metrics.csv")
    analyst_path = os.path.join(out_dir, "test_analyst_coverage.csv")
    pd.DataFrame(all_market).to_csv(market_path, index=False)
    pd.DataFrame(all_metrics).to_csv(metrics_path, index=False)
    pd.DataFrame(all_analyst).to_csv(analyst_path, index=False)
    print(f"\n  Saved: {market_path}")
    print(f"  Saved: {metrics_path}")
    print(f"  Saved: {analyst_path}")

    # Sample rows
    if all_metrics:
        print("\n--- SAMPLE stock_metrics (first 3) ---")
        print(pd.DataFrame(all_metrics).head(3).to_string())
    if all_analyst:
        print("\n--- SAMPLE analyst_coverage (first 3) ---")
        print(pd.DataFrame(all_analyst).head(3).to_string())

    if args.push:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        if not supabase_url or not supabase_key:
            print("\n  --push requires SUPABASE_URL and SUPABASE_ANON_KEY")
            sys.exit(1)
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
        print("\n  Pushing to Supabase...")
        for i in range(0, len(all_market), 500):
            supabase.table("market_data").upsert(all_market[i:i+500], on_conflict="ticker,date").execute()
        for i in range(0, len(all_metrics), 100):
            supabase.table("stock_metrics").upsert(all_metrics[i:i+100], on_conflict="ticker").execute()
        for i in range(0, len(all_analyst), 100):
            supabase.table("analyst_coverage").upsert(all_analyst[i:i+100], on_conflict="ticker").execute()
        print("  Done. Run scoring engine for these 50 if you want: python scripts/run_scoring_engine.py")

    print("\nDone.\n")


if __name__ == "__main__":
    main()
