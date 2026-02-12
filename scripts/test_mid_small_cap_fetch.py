#!/usr/bin/env python3
"""
Test script: fetch market_data + stock_metrics + analyst_coverage for 10 mid/small-cap
tickers using yfinance (same logic as pipeline_daily, no custom session).

Use this to verify we get values for mid/small-cap names before running a full
mid-cap/small-cap pipeline. Uses the correct yfinance pattern (see docs/YFINANCE_USAGE.md):
  - Do NOT pass a custom requests.Session to yf.Ticker() or yf.download()
  - Let yfinance manage its own curl_cffi session

Usage:
  python scripts/test_mid_small_cap_fetch.py

Optional: set TICKER_LIST env or edit MID_SMALL_CAP_TICKERS below.
"""

import os
import sys
from datetime import datetime
from io import StringIO

import numpy as np
import pandas as pd
import yfinance as yf

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
sys.path.insert(0, _project_root)

# 10 mid/small-cap tickers (more prone to coverage gaps / opportunities)
# Replace or extend with a Russell 2000 CSV later for full pipeline
MID_SMALL_CAP_TICKERS = [
    "IONQ",   # small cap
    "SOFI",
    "RIVN",
    "PLTR",
    "COIN",
    "MSTR",
    "AFRM",
    "UPST",
    "HOOD",
    "RBLX",
]

# Use same cache as pipeline_daily so yfinance works locally
_yf_cache = os.path.join(_project_root, ".yfinance_cache")
os.makedirs(_yf_cache, exist_ok=True)
try:
    yf.set_tz_cache_location(_yf_cache)
except Exception:
    pass


def fetch_one_ticker(ticker: str):
    """
    Same logic as pipeline_daily.fetch_one_ticker: no custom session,
    yf.Ticker(ticker) + yf.download(ticker, period="1y").
    Returns (market_rows, metrics_row, analyst_row).
    """
    try:
        # IMPORTANT: do not pass session=... — let yfinance manage its own session
        stock = yf.Ticker(ticker)
        hist = yf.download(ticker, period="1y", progress=False)
        info = stock.info if hasattr(stock, "info") else {}

        if hist is None or hist.empty:
            return ([], None, {"ticker": ticker, "analyst_count": 0, "updated_at": datetime.utcnow().isoformat()})

        # Normalize MultiIndex columns (same as pipeline_daily)
        if isinstance(hist.columns, pd.MultiIndex):
            top_levels = hist.columns.get_level_values(0).unique()
            flat = {}
            for lev in top_levels:
                part = hist[lev]
                if isinstance(part, pd.DataFrame):
                    flat[lev] = part.iloc[:, 0]
                else:
                    flat[lev] = part
            hist = pd.DataFrame(flat, index=hist.index)

        market_rows = []
        metrics_row = None
        analyst_row = None

        def _s(val):
            if hasattr(val, "iloc"):
                return val.iloc[0]
            return val

        if len(hist) >= 5:
            for date_ts, row in hist.iterrows():
                vol = _s(row.get("Volume"))
                vol = 0 if (vol is None or (isinstance(vol, float) and np.isnan(vol))) else int(vol)
                market_rows.append({
                    "ticker": ticker,
                    "date": date_ts.strftime("%Y-%m-%d"),
                    "open": round(float(_s(row["Open"])), 4),
                    "high": round(float(_s(row["High"])), 4),
                    "low": round(float(_s(row["Low"])), 4),
                    "close": round(float(_s(row["Close"])), 4),
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
            last_vol = hist["Volume"].iloc[-1]
            vol_latest = 0 if (last_vol is None or (isinstance(last_vol, float) and np.isnan(last_vol))) else int(last_vol)
            pe_raw = info.get("trailingPE")
            pe_ratio = None
            if pe_raw is not None and not (isinstance(pe_raw, float) and np.isnan(pe_raw)):
                try:
                    pe_ratio = round(float(pe_raw), 4)
                except (TypeError, ValueError):
                    pass
            metrics_row = {
                "ticker": ticker,
                "avg_volume_20d": avg_vol,
                "volatility_20d": vol_20,
                "price_change_1m": ch1,
                "price_change_3m": ch3,
                "current_price": cur,
                "year_high": yh,
                "year_low": yl,
                "volume": vol_latest,
                "pe_ratio": pe_ratio,
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
        print(f"  [{ticker}] Error: {e}")
        return ([], None, {"ticker": ticker, "analyst_count": 0, "updated_at": datetime.utcnow().isoformat()})


def main():
    tickers = os.getenv("TICKER_LIST", "").strip().split() if os.getenv("TICKER_LIST") else MID_SMALL_CAP_TICKERS
    tickers = [t for t in tickers if t]
    if not tickers:
        tickers = MID_SMALL_CAP_TICKERS

    print("Mid/small-cap fetch test (yfinance, no custom session)\n")
    print(f"Tickers ({len(tickers)}): {', '.join(tickers)}\n")

    results = []
    for i, ticker in enumerate(tickers):
        print(f"  [{i+1}/{len(tickers)}] {ticker}...", end=" ", flush=True)
        market_rows, metrics_row, analyst_row = fetch_one_ticker(ticker)
        n_market = len(market_rows)
        if metrics_row:
            cur = metrics_row.get("current_price")
            vol = metrics_row.get("volume")
            avg_vol = metrics_row.get("avg_volume_20d")
            pe = metrics_row.get("pe_ratio")
            ac = analyst_row.get("analyst_count", 0) if analyst_row else 0
            first_date = market_rows[0]["date"] if market_rows else ""
            last_date = market_rows[-1]["date"] if market_rows else ""
            print(f"OK — {n_market} days, price={cur}, vol={vol}, avg_vol_20d={avg_vol}, pe={pe}, analysts={ac}, range={first_date}..{last_date}")
            results.append({
                "ticker": ticker,
                "status": "OK",
                "market_rows": n_market,
                "current_price": cur,
                "volume": vol,
                "avg_volume_20d": avg_vol,
                "pe_ratio": pe,
                "analyst_count": ac,
                "date_range": f"{first_date}..{last_date}",
            })
        else:
            print(f"FAIL — no metrics (market_rows={n_market})")
            results.append({
                "ticker": ticker,
                "status": "FAIL",
                "market_rows": n_market,
                "current_price": None,
                "volume": None,
                "avg_volume_20d": None,
                "pe_ratio": None,
                "analyst_count": analyst_row.get("analyst_count", 0) if analyst_row else 0,
                "date_range": "",
            })

    ok = sum(1 for r in results if r["status"] == "OK")
    print(f"\nSummary: {ok}/{len(tickers)} tickers got full data (market_data + metrics).")
    if ok < len(tickers):
        print("Failed:", [r["ticker"] for r in results if r["status"] == "FAIL"])
    print("\nDone.")


if __name__ == "__main__":
    main()
