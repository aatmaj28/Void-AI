#!/usr/bin/env python3
"""
Daily Pipeline: Fetch fresh market + analyst data from yfinance and run scoring engine.

Runs all 3 categories in sequence: S&P 500 (large cap) → S&P 400 (mid cap) → Russell 2000 (small cap).
For each ticker: yfinance history(1y) + info → market_data, stock_metrics, analyst_coverage, companies (with cap_type).
5 second pause between categories. Chunk size 50: fetch 50 → upsert → next 50.
Prints per-category and total passed/failed counts at the end.

Usage:
  python scripts/pipeline_daily.py

Env (from .env.local or environment):
  SUPABASE_URL, SUPABASE_ANON_KEY

Optional:
  DELAY_SECONDS=0.35   (between tickers; increase if rate limited)
  PROGRESS_EVERY=50
  FAIL_IF_FETCH_PCT=50   (exit 1 if this many % of tickers fail in a chunk; 0 = never fail job)
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
RUSSELL_2000_URL = "https://raw.githubusercontent.com/ikoniaris/Russell2000/master/russell_2000_components.csv"
WIKIPEDIA_SP400_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_400_companies"
DELAY = float(os.getenv("DELAY_SECONDS", "0.35"))
PROGRESS_EVERY = int(os.getenv("PROGRESS_EVERY", "50"))
FAIL_IF_FETCH_PCT = int(os.getenv("FAIL_IF_FETCH_PCT", "0"))  # exit 1 if >= this % of tickers fail in a chunk; 0 = never abort (partial success OK)
# Smaller batches reduce Supabase/Cloudflare timeouts and "Server disconnected" errors
MARKET_BATCH = 200
METRICS_BATCH = 100
ANALYST_BATCH = 100
UPSERT_RETRIES = 4
UPSERT_DELAY_SEC = 2.0
# Fetch this many tickers, then upsert to Supabase, then next chunk. Fail fast if upsert fails.
FETCH_CHUNK = 50
# Pause (seconds) between running each category (S&P 500 → S&P 400 → Russell 2000).
PAUSE_BETWEEN_CATEGORIES_SEC = 5

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Set SUPABASE_URL and SUPABASE_ANON_KEY (env or .env.local)")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def _fetch_sp500():
    r = requests.get(SP500_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    return df["Symbol"].tolist()


def _fetch_russell2000():
    r = requests.get(RUSSELL_2000_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    df.columns = df.columns.str.strip()
    col = "Ticker" if "Ticker" in df.columns else df.columns[0]
    return df[col].astype(str).str.strip().tolist()


def _fetch_sp400():
    headers = {"User-Agent": "VoidAI-Pipeline/1.0 (data fetch; https://github.com)"}
    r = requests.get(WIKIPEDIA_SP400_URL, timeout=15, headers=headers)
    r.raise_for_status()
    tables = pd.read_html(StringIO(r.text), match="Symbol")
    if not tables:
        raise ValueError("No S&P 400 table found on Wikipedia")
    df = tables[0]
    if "Symbol" not in df.columns:
        for c in df.columns:
            if "symbol" in str(c).lower() or df[c].dtype == object:
                return df[c].astype(str).str.strip().tolist()
        return df.iloc[:, 0].astype(str).str.strip().tolist()
    return df["Symbol"].astype(str).str.strip().tolist()


def fetch_tickers():
    """Fetch tickers from configured universes (TICKER_UNIVERSES=sp500,russell2000,sp400). Deduped, sorted."""
    raw = os.getenv("TICKER_UNIVERSES", "sp500").strip().lower()
    universes = [u.strip() for u in raw.split(",") if u.strip()]
    if not universes:
        universes = ["sp500"]
    seen = set()
    for u in universes:
        if u == "sp500":
            for t in _fetch_sp500():
                seen.add(t)
        elif u == "russell2000":
            for t in _fetch_russell2000():
                seen.add(t)
        elif u == "sp400":
            for t in _fetch_sp400():
                seen.add(t)
        else:
            print(f"Warning: unknown universe '{u}', skipping. Use sp500,russell2000,sp400.")
    return sorted(seen)


def fetch_one_ticker(ticker: str):
    """Fetch history(1y) and info for one ticker. Returns (market_rows, metrics_row, analyst_row, company_info). company_info is dict for companies upsert (or None)."""
    try:
        # IMPORTANT: let yfinance manage its own curl_cffi session.
        # Use yf.download for price history (works even when a raw requests call shows 429),
        # and yf.Ticker only for the .info payload.
        stock = yf.Ticker(ticker)
        hist = yf.download(ticker, period="1y", progress=False)
        info = stock.info if hasattr(stock, "info") else {}

        # Normalize to single-level columns (same as minimal_fetch_test.py).
        # yfinance often returns MultiIndex columns; pipeline assumes simple columns.
        if hist is not None and not hist.empty and isinstance(hist.columns, pd.MultiIndex):
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
        company_info = None

        def _s(val):
            """Extract scalar from possibly single-element Series (avoids pandas FutureWarning)."""
            if hasattr(val, "iloc"):
                return val.iloc[0]
            return val

        def _finite_or_default(x, default=0.0):
            """Return a finite float; replace NaN/inf/None with default."""
            try:
                xv = float(x)
            except (TypeError, ValueError):
                return default
            if np.isnan(xv) or np.isinf(xv):
                return default
            return xv

        if hist is not None and not hist.empty and len(hist) >= 5:
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
            vol_20_raw = float(ret_tail.std() * np.sqrt(252)) if len(ret_tail) >= 2 else 0.0
            vol_20 = round(_finite_or_default(vol_20_raw, 0.0), 4)
            cur = round(_finite_or_default(hist["Close"].iloc[-1], 0.0), 4)
            pc1 = hist["Close"].pct_change(21).iloc[-1] if len(hist) >= 22 else np.nan
            pc3 = hist["Close"].pct_change(63).iloc[-1] if len(hist) >= 64 else np.nan
            ch1 = round(_finite_or_default(pc1, 0.0), 4) if pd.notna(pc1) else 0.0
            ch3 = round(_finite_or_default(pc3, 0.0), 4) if pd.notna(pc3) else 0.0
            yh = round(_finite_or_default(hist["High"].max(), 0.0), 4)
            yl = round(_finite_or_default(hist["Low"].min(), 0.0), 4)
            # Latest day volume (for stock detail page)
            last_vol = hist["Volume"].iloc[-1]
            vol_latest = 0 if (last_vol is None or (isinstance(last_vol, float) and np.isnan(last_vol))) else int(last_vol)
            # Trailing P/E from yfinance info (for stock detail page) — clamp non-finite to None
            pe_raw = info.get("trailingPE")
            pe_ratio = None
            if pe_raw is not None:
                try:
                    pe_val = float(pe_raw)
                    if not (np.isnan(pe_val) or np.isinf(pe_val)):
                        pe_ratio = round(pe_val, 4)
                except (TypeError, ValueError):
                    pe_ratio = None
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
            # For companies table upsert (cap_type set in main per category)
            company_info = {
                "name": info.get("longName") or info.get("shortName"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "market_cap": info.get("marketCap"),
                "exchange": info.get("exchange"),
                "country": info.get("country"),
            }
        else:
            company_info = None

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
        return (market_rows, metrics_row, analyst_row, company_info)
    except Exception as e:
        print(f"[{ticker}] Error: {e}")
        return ([], None, {"ticker": ticker, "analyst_count": 0, "updated_at": datetime.utcnow().isoformat()}, None)


def _execute_with_retry(execute_fn, batch_label: str):
    """Run execute_fn(); retry on connection/502/API errors with backoff."""
    for attempt in range(UPSERT_RETRIES):
        try:
            execute_fn()
            return
        except Exception as e:
            err_str = str(type(e).__name__) + ": " + str(e)
            # Retry on: Server disconnected, 502/500, PostgREST APIError (e.g. JSON could not be generated)
            is_retryable = (
                "disconnect" in err_str.lower()
                or "502" in err_str
                or "500" in err_str
                or "APIError" in type(e).__name__
                or "JSON could not be generated" in err_str
            )
            if is_retryable and attempt < UPSERT_RETRIES - 1:
                wait = UPSERT_DELAY_SEC * (2 ** attempt)
                print(f"  Supabase error ({batch_label}), retry in {wait:.0f}s: {err_str[:80]}...")
                time.sleep(wait)
            else:
                raise
    return


def upsert_market_data(rows: list):
    for i in range(0, len(rows), MARKET_BATCH):
        batch = rows[i : i + MARKET_BATCH]
        label = f"market_data batch {i // MARKET_BATCH + 1}/{(len(rows) + MARKET_BATCH - 1) // MARKET_BATCH}"
        _execute_with_retry(
            lambda b=batch: supabase.table("market_data").upsert(b, on_conflict="ticker,date").execute(),
            label,
        )
        time.sleep(0.3)
    print(f"  market_data: {len(rows)} rows")


def upsert_stock_metrics(rows: list):
    for i in range(0, len(rows), METRICS_BATCH):
        batch = rows[i : i + METRICS_BATCH]
        _execute_with_retry(
            lambda b=batch: supabase.table("stock_metrics").upsert(b, on_conflict="ticker").execute(),
            f"stock_metrics batch {i // METRICS_BATCH + 1}",
        )
        time.sleep(0.2)
    print(f"  stock_metrics: {len(rows)} rows")


def upsert_analyst_coverage(rows: list):
    for i in range(0, len(rows), ANALYST_BATCH):
        batch = rows[i : i + ANALYST_BATCH]
        _execute_with_retry(
            lambda b=batch: supabase.table("analyst_coverage").upsert(b, on_conflict="ticker").execute(),
            f"analyst_coverage batch {i // ANALYST_BATCH + 1}",
        )
        time.sleep(0.2)
    print(f"  analyst_coverage: {len(rows)} rows")


COMPANIES_BATCH = 100


def upsert_companies(rows: list):
    """Upsert company rows (ticker, name, sector, industry, market_cap, exchange, cap_type)."""
    if not rows:
        return
    for i in range(0, len(rows), COMPANIES_BATCH):
        batch = rows[i : i + COMPANIES_BATCH]
        _execute_with_retry(
            lambda b=batch: supabase.table("companies").upsert(b, on_conflict="ticker").execute(),
            f"companies batch {i // COMPANIES_BATCH + 1}",
        )
        time.sleep(0.2)
    print(f"  companies: {len(rows)} rows")


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
    print("Daily pipeline — all 3 categories (S&P 500 → S&P 400 → Russell 2000)\n")
    print(f"Chunk size: {FETCH_CHUNK}. Pause between categories: {PAUSE_BETWEEN_CATEGORIES_SEC}s.\n")

    categories = [
        ("S&P 500", _fetch_sp500, "large"),
        ("S&P 400", _fetch_sp400, "mid"),
        ("Russell 2000", _fetch_russell2000, "small"),
    ]
    category_stats = {}  # name -> (passed, failed)
    total_passed = 0
    total_failed = 0
    start = time.time()

    for cat_name, fetch_fn, cap_type in categories:
        print("=" * 60)
        print(f"Category: {cat_name} (cap_type={cap_type})")
        print("=" * 60)
        try:
            tickers = fetch_fn()
        except Exception as e:
            print(f"Error fetching {cat_name} list: {e}")
            category_stats[cat_name] = (0, 0)
            time.sleep(PAUSE_BETWEEN_CATEGORIES_SEC)
            continue
        print(f"Tickers: {len(tickers)}. Processing in chunks of {FETCH_CHUNK}.\n")
        cat_passed = 0
        cat_failed = 0

        for chunk_start in range(0, len(tickers), FETCH_CHUNK):
            chunk = tickers[chunk_start : chunk_start + FETCH_CHUNK]
            chunk_num = chunk_start // FETCH_CHUNK + 1
            num_chunks = (len(tickers) + FETCH_CHUNK - 1) // FETCH_CHUNK
            print(f"--- {cat_name} Chunk {chunk_num}/{num_chunks}: tickers {chunk_start + 1}-{chunk_start + len(chunk)} ---")

            chunk_market = []
            chunk_metrics = []
            chunk_analyst = []
            chunk_companies = []
            chunk_failed = 0
            for i, ticker in enumerate(chunk):
                market_rows, metrics_row, analyst_row, company_info = fetch_one_ticker(ticker)
                if metrics_row:
                    # Only add to child tables (market_data, stock_metrics, analyst_coverage) when we have data
                    # and will insert into companies (FK constraint). This ensures data completeness and FK integrity.
                    chunk_market.extend(market_rows)
                    chunk_metrics.append(metrics_row)
                    chunk_analyst.append(analyst_row)
                    cat_passed += 1
                    if company_info is not None:
                        chunk_companies.append({
                            "ticker": ticker,
                            "name": company_info.get("name"),
                            "sector": company_info.get("sector"),
                            "industry": company_info.get("industry"),
                            "market_cap": company_info.get("market_cap"),
                            "exchange": company_info.get("exchange"),
                            "country": company_info.get("country"),
                            "cap_type": cap_type,
                        })
                else:
                    cat_failed += 1
                if not market_rows:
                    chunk_failed += 1
                if (i + 1) % PROGRESS_EVERY == 0:
                    elapsed = time.time() - start
                    print(f"  Progress: {chunk_start + i + 1}/{len(tickers)} — {len(chunk_market)} market rows, {len(chunk_metrics)} metrics — {elapsed:.0f}s")
                time.sleep(DELAY)

            fail_pct = (100 * chunk_failed / len(chunk)) if chunk else 0
            if FAIL_IF_FETCH_PCT > 0 and fail_pct >= FAIL_IF_FETCH_PCT:
                print(f"Error: {fail_pct:.0f}% of tickers failed in this chunk (threshold {FAIL_IF_FETCH_PCT}%).")
                sys.exit(1)
            elif chunk_failed > 0:
                print(f"  Note: {chunk_failed}/{len(chunk)} tickers in this chunk had no data (continuing).")

            print(f"  Chunk fetch done: {len(chunk_market)} market rows, {len(chunk_metrics)} metrics. Upserting to Supabase...")
            # Upsert companies first: market_data (and possibly others) have FK to companies.ticker
            upsert_companies(chunk_companies)
            upsert_market_data(chunk_market)
            upsert_stock_metrics(chunk_metrics)
            upsert_analyst_coverage(chunk_analyst)
            print(f"  Chunk {chunk_num} upserted.\n")

        category_stats[cat_name] = (cat_passed, cat_failed)
        total_passed += cat_passed
        total_failed += cat_failed
        print(f"{cat_name} done: {cat_passed} passed, {cat_failed} failed.\n")
        if cat_name != categories[-1][0]:
            print(f"Pausing {PAUSE_BETWEEN_CATEGORIES_SEC}s before next category...\n")
            time.sleep(PAUSE_BETWEEN_CATEGORIES_SEC)

    elapsed = time.time() - start
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for cat_name, (passed, failed) in category_stats.items():
        print(f"  {cat_name}: {passed} passed, {failed} failed")
    print(f"  Total: {total_passed} passed, {total_failed} failed")
    print(f"\nFetch + upsert done in {elapsed:.0f}s.\n")

    print("Running scoring engine...\n")
    scoring_ok = run_scoring_engine()

    print("\nDaily pipeline finished.\n")
    sys.exit(0 if scoring_ok == 0 else 1)


if __name__ == "__main__":
    main()
