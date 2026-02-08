#!/usr/bin/env python3
"""
Daily Pipeline: Fetch fresh market + analyst data from yfinance and run scoring engine.

Runs headless (no Colab). Use with GitHub Actions cron or a cloud worker so users
see updated data every morning after market close.

Steps:
  1. Fetch S&P 500 list from GitHub
  2. For each ticker: yfinance history(1y) + info → market_data, stock_metrics, analyst_coverage
  3. Batch upsert market_data, stock_metrics, analyst_coverage to Supabase
  4. Run scoring engine (coverage_gap_scores)

Usage:
  python scripts/pipeline_daily.py

Env (from .env.local or environment):
  SUPABASE_URL, SUPABASE_ANON_KEY

Optional:
  DELAY_SECONDS=0.35   (between tickers; increase if rate limited)
  PROGRESS_EVERY=50
"""

import os
import sys
import time
import subprocess
import requests
import pandas as pd
import numpy as np
import yfinance as yf
from io import StringIO
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

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

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
SP500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
DELAY = float(os.getenv("DELAY_SECONDS", "0.35"))
PROGRESS_EVERY = int(os.getenv("PROGRESS_EVERY", "50"))
MARKET_BATCH = 500
METRICS_BATCH = 100
ANALYST_BATCH = 100

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Set SUPABASE_URL and SUPABASE_ANON_KEY (env or .env.local)")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_tickers():
    r = requests.get(SP500_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    return df["Symbol"].tolist()


def fetch_one_ticker(ticker: str):
    """Fetch history(1y) and info for one ticker. Returns (market_rows, metrics_row, analyst_row) or (None, None, None)."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")
        info = stock.info if hasattr(stock, "info") else {}

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
        print(f"[{ticker}] Error: {e}")
        return ([], None, {"ticker": ticker, "analyst_count": 0, "updated_at": datetime.utcnow().isoformat()})


def upsert_market_data(rows: list):
    for i in range(0, len(rows), MARKET_BATCH):
        batch = rows[i : i + MARKET_BATCH]
        supabase.table("market_data").upsert(batch, on_conflict="ticker,date").execute()
    print(f"  market_data: {len(rows)} rows")


def upsert_stock_metrics(rows: list):
    for i in range(0, len(rows), METRICS_BATCH):
        batch = rows[i : i + METRICS_BATCH]
        supabase.table("stock_metrics").upsert(batch, on_conflict="ticker").execute()
    print(f"  stock_metrics: {len(rows)} rows")


def upsert_analyst_coverage(rows: list):
    for i in range(0, len(rows), ANALYST_BATCH):
        batch = rows[i : i + ANALYST_BATCH]
        supabase.table("analyst_coverage").upsert(batch, on_conflict="ticker").execute()
    print(f"  analyst_coverage: {len(rows)} rows")


def run_scoring_engine():
    script = os.path.join(_script_dir, "run_scoring_engine.py")
    result = subprocess.run(
        [sys.executable, script],
        env={**os.environ, "PYTHONPATH": _project_root},
        cwd=_project_root,
        capture_output=False,
    )
    if result.returncode != 0:
        print("Warning: run_scoring_engine.py exited with code", result.returncode)
    return result.returncode


def main():
    print("Daily pipeline — fetch yfinance + Supabase + scoring\n")
    tickers = fetch_tickers()
    print(f"Tickers: {len(tickers)}\n")

    all_market = []
    all_metrics = []
    all_analyst = []
    failed = 0
    start = time.time()

    for i, ticker in enumerate(tickers):
        market_rows, metrics_row, analyst_row = fetch_one_ticker(ticker)
        all_market.extend(market_rows)
        if metrics_row:
            all_metrics.append(metrics_row)
        all_analyst.append(analyst_row)
        if not market_rows:
            failed += 1
        if (i + 1) % PROGRESS_EVERY == 0:
            elapsed = time.time() - start
            print(f"  Progress: {i + 1}/{len(tickers)} — {len(all_market)} market rows, {len(all_metrics)} metrics — {elapsed:.0f}s")
        time.sleep(DELAY)

    elapsed = time.time() - start
    print(f"\nFetch done in {elapsed:.0f}s. Failed: {failed}. Upserting to Supabase...\n")

    upsert_market_data(all_market)
    upsert_stock_metrics(all_metrics)
    upsert_analyst_coverage(all_analyst)

    print("\nRunning scoring engine...\n")
    run_scoring_engine()

    print("\nDaily pipeline finished.\n")


if __name__ == "__main__":
    main()
